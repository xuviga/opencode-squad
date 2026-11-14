import type { Plugin } from "@opencode/plugin";

export type WorktreeRemoval = {
  directory: string;
  removed: boolean;
  error?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
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
