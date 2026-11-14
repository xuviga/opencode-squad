import { spawnSync } from "node:child_process";

/** True when `directory` is inside a git work tree. */
export function isGitRepository(directory: string): boolean {
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0 && result.stdout.trim() === "true";
}

/** Absolute git top-level directory, or undefined outside a repository. */
export function gitRoot(directory: string): string | undefined {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return undefined;
  const root = result.stdout.trim();
  return root.length > 0 ? root : undefined;
}
