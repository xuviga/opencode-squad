import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

const SKIP_DIRECTORIES = new Set([
  ".git",
  ".squad",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".cache",
  "coverage",
  "target",
  ".venv",
  "venv",
  "__pycache__",
  ".idea",
  ".vscode",
  ".turbo",
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 5_000;
const MAX_PATCH_CHARS = 8_000;
const MAX_TOTAL_PATCH_CHARS = 120_000;

export type SnapshotEntry = {
  path: string;
  size: number;
  hash: string;
  stored: boolean;
};

export type SnapshotManifest = {
  createdAt: string;
  root: string;
  truncated: boolean;
  entries: Record<string, SnapshotEntry>;
};

export type SnapshotFileChange = {
  file: string;
  status: "added" | "modified" | "deleted" | "binary";
  patch: string;
};

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function hashBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isBinary(bytes: Buffer): boolean {
  const probe = bytes.subarray(0, 8192);
  return probe.includes(0);
}

function walk(root: string): { files: string[]; truncated: boolean } {
  const files: string[] = [];
  let truncated = false;

  const visit = (directory: string) => {
    if (files.length >= MAX_FILES) {
      truncated = true;
      return;
    }
    let entries: Array<{
      name: string;
      isDirectory(): boolean;
      isFile(): boolean;
      isSymbolicLink(): boolean;
    }>;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        visit(absolute);
        if (files.length >= MAX_FILES) {
          truncated = true;
          return;
        }
        continue;
      }
      if (!entry.isFile()) continue;
      files.push(toPosix(relative(root, absolute)));
      if (files.length >= MAX_FILES) {
        truncated = true;
        return;
      }
    }
  };

  visit(root);
  return { files, truncated };
}

/**
 * Copies text files of the project into a snapshot directory and records a
 * hash manifest. Used in in-place isolation mode, where there is no git diff.
 */
export function captureSnapshot(sourceDirectory: string, snapshotDirectory: string): SnapshotManifest {
  rmSync(snapshotDirectory, { recursive: true, force: true });
  mkdirSync(join(snapshotDirectory, "files"), { recursive: true });

  const { files, truncated } = walk(sourceDirectory);
  const entries: Record<string, SnapshotEntry> = {};

  for (const path of files) {
    const absolute = join(sourceDirectory, ...path.split("/"));
    let bytes: Buffer;
    try {
      const info = statSync(absolute);
      if (info.size > MAX_FILE_BYTES) {
        entries[path] = { path, size: info.size, hash: "skipped:large", stored: false };
        continue;
      }
      bytes = readFileSync(absolute);
    } catch {
      continue;
    }
    const stored = !isBinary(bytes);
    if (stored) {
      const target = join(snapshotDirectory, "files", ...path.split("/"));
      mkdirSync(join(target, ".."), { recursive: true });
      copyFileSync(absolute, target);
    }
    entries[path] = { path, size: bytes.length, hash: hashBytes(bytes), stored };
  }

  const manifest: SnapshotManifest = {
    createdAt: new Date().toISOString(),
    root: sourceDirectory,
    truncated,
    entries,
  };
  writeFileSync(
    join(snapshotDirectory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  return manifest;
}

export function readSnapshot(snapshotDirectory: string): SnapshotManifest {
  const file = join(snapshotDirectory, "manifest.json");
  if (!existsSync(file)) {
    throw new Error(`snapshot is missing: ${snapshotDirectory}`);
  }
  return JSON.parse(readFileSync(file, "utf8")) as SnapshotManifest;
}

/** LCS-based line diff. Falls back to a coarse summary on huge files. */
function lineDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  if (oldLines.length * newLines.length > 1_000_000) {
    return `(large file: ${oldLines.length} -> ${newLines.length} lines)`;
  }

  const rows = oldLines.length + 1;
  const columns = newLines.length + 1;
  const table = new Uint32Array(rows * columns);
  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      table[i * columns + j] =
        oldLines[i] === newLines[j]
          ? table[(i + 1) * columns + j + 1]! + 1
          : Math.max(table[(i + 1) * columns + j]!, table[i * columns + j + 1]!);
    }
  }

  const output: string[] = [];
  let i = 0;
  let j = 0;
  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      output.push(`  ${oldLines[i]}`);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * columns + j]! >= table[i * columns + j + 1]!) {
      output.push(`- ${oldLines[i]}`);
      i += 1;
    } else {
      output.push(`+ ${newLines[j]}`);
      j += 1;
    }
  }
  while (i < oldLines.length) {
    output.push(`- ${oldLines[i]}`);
    i += 1;
  }
  while (j < newLines.length) {
    output.push(`+ ${newLines[j]}`);
    j += 1;
  }

  const text = output.join("\n");
  return text.length > MAX_PATCH_CHARS ? `${text.slice(0, MAX_PATCH_CHARS)}\n...(truncated)` : text;
}

/**
 * Compares the snapshot with the current project directory and returns
 * per-file changes suitable for a blind reviewer.
 */
export function snapshotDiff(
  snapshotDirectory: string,
  currentDirectory: string,
): {
  source: "snapshot";
  snapshot: { createdAt: string; root: string };
  data: SnapshotFileChange[];
  truncated: boolean;
  trimmedFiles: string[];
} {
  const manifest = readSnapshot(snapshotDirectory);
  const { files, truncated } = walk(currentDirectory);
  const changed: SnapshotFileChange[] = [];
  const trimmedFiles: string[] = [];
  let total = 0;

  // Every changed file is listed. Once the patch budget is exhausted the file
  // keeps its header with an empty patch, so a reviewer can never silently miss
  // files that sort late in the alphabet.
  const push = (change: SnapshotFileChange) => {
    const room = MAX_TOTAL_PATCH_CHARS - total;
    if (room <= 0) {
      trimmedFiles.push(change.file);
      changed.push({ ...change, patch: "" });
      return;
    }
    const patch =
      change.patch.length > room
        ? `${change.patch.slice(0, room)}\n...(truncated)`
        : change.patch;
    if (patch.length < change.patch.length) trimmedFiles.push(change.file);
    changed.push({ ...change, patch });
    total += patch.length;
  };

  const currentSet = new Set(files);
  for (const path of files) {
    const absolute = join(currentDirectory, ...path.split("/"));
    let bytes: Buffer;
    try {
      const info = statSync(absolute);
      if (info.size > MAX_FILE_BYTES) continue;
      bytes = readFileSync(absolute);
    } catch {
      continue;
    }
    const hash = hashBytes(bytes);
    const previous = manifest.entries[path];

    if (!previous) {
      if (isBinary(bytes)) {
        push({ file: path, status: "binary", patch: "(new binary file)" });
      } else {
        const text = bytes.toString("utf8");
        push({
          file: path,
          status: "added",
          patch: text
            .split(/\r?\n/)
            .map((line) => `+ ${line}`)
            .join("\n"),
        });
      }
      continue;
    }

    if (previous.hash === hash) continue;

    if (isBinary(bytes) || !previous.stored) {
      push({ file: path, status: "binary", patch: "(binary or large file changed)" });
      continue;
    }

    const oldFile = join(snapshotDirectory, "files", ...path.split("/"));
    const oldText = existsSync(oldFile) ? readFileSync(oldFile, "utf8") : "";
    push({ file: path, status: "modified", patch: lineDiff(oldText, bytes.toString("utf8")) });
  }

  for (const [path, entry] of Object.entries(manifest.entries)) {
    if (currentSet.has(path)) continue;
    if (!entry.stored) {
      push({ file: path, status: "deleted", patch: "(binary or large file deleted)" });
      continue;
    }
    const oldFile = join(snapshotDirectory, "files", ...path.split("/"));
    const oldText = existsSync(oldFile) ? readFileSync(oldFile, "utf8") : "";
    push({
      file: path,
      status: "deleted",
      patch: oldText
        .split(/\r?\n/)
        .map((line) => `- ${line}`)
        .join("\n"),
    });
  }

  return {
    source: "snapshot",
    snapshot: { createdAt: manifest.createdAt, root: manifest.root },
    data: changed,
    truncated: manifest.truncated || truncated || trimmedFiles.length > 0,
    trimmedFiles,
  };
}

/**
 * Renders a diff (git or snapshot) for a model prompt without dropping files:
 * every file header is kept, patches share the remaining budget.
 */
export function formatDiffForPrompt(diff: unknown, maxChars = 120_000): string {
  const record = diff as {
    data?: Array<{ file?: string; status?: string; patch?: string }>;
    trimmedFiles?: string[];
    truncated?: boolean;
  } | null;

  if (!record || !Array.isArray(record.data)) {
    const text = JSON.stringify(diff, null, 2);
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n...(truncated)` : text;
  }

  const files = record.data;
  const budget = Math.max(4_000, maxChars);
  const headerCost = files.reduce(
    (sum, item) => sum + `### ${item.file ?? "unknown"} [${item.status ?? "changed"}]\n`.length,
    0,
  );
  const patchBudget = Math.max(0, budget - headerCost);
  const perFile = files.length
    ? Math.max(200, Math.min(8_000, Math.floor(patchBudget / files.length)))
    : 0;
  const chunks: string[] = [];
  const trimmed: string[] = [];
  let remaining = patchBudget;

  for (const item of files) {
    const name = item.file ?? "unknown";
    const header = `### ${name} [${item.status ?? "changed"}]`;
    const patch = item.patch ?? "";
    const room = Math.max(0, Math.min(perFile, remaining));
    const body =
      room <= 0
        ? "(patch omitted: diff budget reached; file is changed)"
        : patch.length > room
          ? `${patch.slice(0, room)}\n...(truncated)`
          : patch;
    if (room <= 0 || body.length < patch.length || patch.length === 0) trimmed.push(name);
    remaining = Math.max(0, remaining - Math.min(patch.length, room));
    chunks.push(`${header}\n${body}`);
  }

  const meta = [
    `files: ${files.length}`,
    `budget: ${budget - remaining}/${budget} chars`,
    ...(record.truncated || record.trimmedFiles?.length || trimmed.length
      ? [
          `partial patches: ${[...new Set([...(record.trimmedFiles ?? []), ...trimmed])].join(", ")}`,
        ]
      : []),
  ].join("; ");

  return `${meta}\n\n${chunks.join("\n\n")}`;
}
