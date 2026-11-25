import type { Plugin } from "@opencode/plugin";
import { randomUUID } from "node:crypto";

export type WorktreeRemoval = {
  directory: string;
  removed: boolean;
  error?: string;
};

export type WorktreeProbe = {
  ok: boolean;
  directory?: string;
  error?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

const PROBE_TTL_MS = 30_000;
let probeCache: { at: number; result: WorktreeProbe } | null = null;

/**
 * Creates and removes a throwaway worktree to prove the host can actually do
 * it. `isolation.worktreeAvailable` only says the folder is a git repository;
 * the host can still refuse to create a worktree (a stale worktree registry
 * is one known cause), and a mission that hires afterwards would fail.
 */
export async function probeWorktree(ctx: Plugin.Context, force = false): Promise<WorktreeProbe> {
  if (!force && probeCache && Date.now() - probeCache.at < PROBE_TTL_MS) {
    return probeCache.result;
  }
  const projectID = ctx.location.project.id;
  const name = `squad-probe-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  let result: WorktreeProbe;
  try {
    const worktree = await ctx.worktree.create({ projectID, name });
    result = { ok: true, directory: worktree.directory };
    await ctx.worktree
      .remove({ projectID, directory: worktree.directory, force: true })
      .catch(() => undefined);
  } catch (error) {
    result = { ok: false, error: errorMessage(error) };
  }
  probeCache = { at: Date.now(), result };
  return result;
}

/** Test-only reset of the probe cache. */
export function resetWorktreeProbeCache(): void {
  probeCache = null;
}

/**
 * Removes a staff worktree. `force: false` (default) refuses to delete a dirty
 * worktree so uncommitted worker output is never silently lost. Callers that
 * are deliberately discarding an aborted mission pass `force: true`.
 */
export async function removeWorktree(
  ctx: Plugin.Context,
  directory: string,
  options: { force?: boolean } = {},
): Promise<WorktreeRemoval> {
  const projectID = ctx.location.project.id;
  const force = options.force ?? false;
  try {
    await ctx.worktree.remove({ projectID, directory, force });
    return { directory, removed: true };
  } catch (error) {
    return { directory, removed: false, error: errorMessage(error) };
  }
}

/**
 * Best-effort sweep: never throws, returns one result per directory.
 */
export async function removeWorktrees(
  ctx: Plugin.Context,
  directories: string[],
  options: { force?: boolean } = {},
): Promise<WorktreeRemoval[]> {
  const results: WorktreeRemoval[] = [];
  for (const directory of directories) {
    results.push(await removeWorktree(ctx, directory, options));
  }
  return results;
}
