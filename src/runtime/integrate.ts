import { execFileSync, spawnSync } from "node:child_process";

export type IntegrationResult = {
  commit: string;
  alreadyMerged: boolean;
};

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
}

/**
 * Integrates a worker worktree commit into the main checkout.
 * Refuses to run when the main checkout is dirty; aborts a conflicting
 * cherry-pick and reports the conflict.
 */
export function integrateWorktree(mainDirectory: string, worktreeDirectory: string): IntegrationResult {
  const commit = git(["rev-parse", "HEAD"], worktreeDirectory).trim();
  if (!commit) throw new Error("worktree has no HEAD commit");

  const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
    cwd: mainDirectory,
    encoding: "utf8",
    windowsHide: true,
  });
  if (ancestry.status === 0) {
    return { commit, alreadyMerged: true };
  }

  const dirty = git(["status", "--porcelain"], mainDirectory).trim();
  if (dirty) {
    throw new Error(
      `main checkout is dirty; commit or stash before integration:\n${dirty.slice(0, 2000)}`,
    );
  }

  try {
    git(["cherry-pick", commit], mainDirectory);
  } catch (error) {
    try {
      git(["cherry-pick", "--abort"], mainDirectory);
    } catch {
      // best-effort abort
    }
    throw new Error(
      `cherry-pick failed for ${commit}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return { commit, alreadyMerged: false };
}
