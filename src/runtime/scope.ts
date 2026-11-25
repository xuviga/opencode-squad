/**
 * Per-task path allowlists.
 *
 * In `isolation: "none"` the reviewer sees a folder-wide snapshot diff: every
 * file changed by sibling tasks in the same folder shows up in every task's
 * diff. That produced false "modified files outside scope" failures. A task
 * may now declare the paths it owns; the diff is partitioned and the reviewer
 * is told which files belong to somebody else.
 */

export function normalizePathLike(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  let out = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        out += ".*";
        index += 1;
        if (pattern[index + 1] === "/") index += 1;
      } else {
        out += "[^/]*";
      }
    } else if (char === "?") {
      out += "[^/]";
    } else {
      out += escapeRegExp(char);
    }
  }
  return new RegExp(`^${out}$`);
}

/** Exact path, directory prefix (`docs/`), or glob (`src/**\/*.ts`). */
export function pathMatches(file: string, pattern: string): boolean {
  const normalizedFile = normalizePathLike(file);
  const normalizedPattern = normalizePathLike(pattern);
  if (!normalizedPattern) return false;
  if (normalizedPattern.endsWith("/")) {
    const prefix = normalizedPattern.slice(0, -1);
    return normalizedFile === prefix || normalizedFile.startsWith(`${prefix}/`);
  }
  if (normalizedPattern.includes("*") || normalizedPattern.includes("?")) {
    return globToRegExp(normalizedPattern).test(normalizedFile);
  }
  return normalizedFile === normalizedPattern;
}

export type DiffEntry = { file?: string; status?: string; patch?: string };export type ScopedDiff = {
  diff: unknown;
  allowlist: string[];
  inScope: string[];
  outOfScope: string[];
};

function entriesOf(diff: unknown): DiffEntry[] | null {
  if (!diff || typeof diff !== "object") return null;
  const data = (diff as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  return data as DiffEntry[];
}

/**
 * Splits a diff into the files this task owns and files changed by sibling
 * work. With an empty allowlist everything is in scope (old behaviour).
 */
export function partitionDiff(diff: unknown, allowlist: readonly string[]): ScopedDiff {
  const normalized = allowlist.map(normalizePathLike).filter(Boolean);
  const entries = entriesOf(diff);
  if (!entries || normalized.length === 0) {
    return {
      diff,
      allowlist: normalized,
      inScope: entries ? entries.map((entry) => entry.file ?? "unknown") : [],
      outOfScope: [],
    };
  }

  const inScope: DiffEntry[] = [];
  const outOfScope: string[] = [];
  const inScopeFiles: string[] = [];

  for (const entry of entries) {
    const file = entry.file ?? "unknown";
    const owned = normalized.some((pattern) => pathMatches(file, pattern));
    if (owned) {
      inScope.push(entry);
      inScopeFiles.push(file);
    } else {
      outOfScope.push(file);
    }
  }

  const cloned = { ...(diff as Record<string, unknown>), data: inScope };
  return { diff: cloned, allowlist: normalized, inScope: inScopeFiles, outOfScope };
}

/** Reads `paths` from a Task Brief without trusting its shape. */
export function allowlistFromBrief(brief: unknown): string[] {
  if (!brief || typeof brief !== "object") return [];
  const paths = (brief as { paths?: unknown }).paths;
  if (!Array.isArray(paths)) return [];
  return paths.filter((value): value is string => typeof value === "string");
}

/**
 * Files changed by a worker that the task does not own.
 *
 * Only trustworthy where the diff is attributable to one worker (a git
 * worktree). In `isolation: "none"` the snapshot diff is folder-wide, so this
 * reports sibling work as well and must stay advisory.
 */
export function scopeViolations(allowlist: readonly string[], diff: unknown): string[] {
  if (allowlist.length === 0) return [];
  return partitionDiff(diff, allowlist).outOfScope;
}

export type SiblingScope = {
  id: string;
  paths: readonly string[];
  /** Still able to write into the folder. */
  concurrent: boolean;
};

export type InPlaceAttribution = {
  mine: string[];
  siblingFiles: string[];
  /** Changed by nobody's declared scope: this worker's violation. */
  unclaimed: string[];
  /** False when some concurrent writer declared no paths. */
  enforceable: boolean;
};

/**
 * Attributes a folder-wide in-place diff using every task's allowlist.
 *
 * A file is this worker's when it matches the task's own paths, a sibling's
 * when a concurrent sibling claims it, and unclaimed otherwise — which means
 * the worker wrote something it did not declare. Attribution is only sound
 * when every concurrent writer declared paths; otherwise it stays advisory.
 */
export function attributeInPlace(
  diff: unknown,
  allowlist: readonly string[],
  siblings: readonly SiblingScope[],
): InPlaceAttribution {
  const files = (entriesOf(diff) ?? []).map((entry) => entry.file ?? "unknown");
  const mine: string[] = [];
  const siblingFiles: string[] = [];
  const unclaimed: string[] = [];

  for (const file of files) {
    if (allowlist.some((pattern) => pathMatches(file, pattern))) {
      mine.push(file);
      continue;
    }
    const owner = siblings.find(
      (sibling) => sibling.concurrent && sibling.paths.some((pattern) => pathMatches(file, pattern)),
    );
    if (owner) siblingFiles.push(file);
    else unclaimed.push(file);
  }

  const concurrentWriterWithoutPaths = siblings.some(
    (sibling) => sibling.concurrent && sibling.paths.length === 0,
  );

  return {
    mine,
    siblingFiles,
    unclaimed,
    enforceable: allowlist.length > 0 && !concurrentWriterWithoutPaths,
  };
}
