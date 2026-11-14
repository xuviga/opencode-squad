import { execFileSync } from "node:child_process";

export type WorktreeCommit = {
  committed: boolean;
  commit: string | null;
  files: number;
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
 * Writers with `write` access cannot run git. The orchestrator commits the
 * isolated worktree on their behalf so `squad_integrate` can cherry-pick it.
 */
export function commitWorktree(directory: string, message: string): WorktreeCommit {
  const status = git(["status", "--porcelain"], directory).trim();
  if (!status) {
    return { committed: false, commit: null, files: 0 };
  }
  const files = status.split(/\r?\n/).filter(Boolean).length;
  git(["add", "-A"], directory);
  git(["commit", "-m", message], directory);
  return {
    committed: true,
    commit: git(["rev-parse", "HEAD"], directory).trim(),
    files,
  };
}
