import type { Plugin } from "@opencode/plugin";
import { execFileSync } from "node:child_process";
import type { SquadStore, Task } from "../db/store";

type DiffFile = { file: string; patch: string; status: string; [key: string]: unknown };

function git(args: string[], cwd: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Diff for an isolated worker worktree.
 * The plugin VCS API ignores the `location` input, so we read git directly
 * from the staff worktree. Both committed (HEAD^) and working changes are
 * included; untracked files are listed but have no patch.
 */
function worktreeDiff(directory: string): DiffFile[] {
  const files = new Set<string>();

  for (const args of [
    ["diff", "--name-only", "HEAD^"],
    ["diff", "--name-only"],
    ["diff", "--name-only", "--cached"],
  ]) {
    for (const file of splitLines(git(args, directory))) files.add(file);
  }

  const status = git(["status", "--porcelain"], directory);
  const untracked = new Set<string>();
  for (const line of status.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const flag = line.slice(0, 2);
    const file = line.slice(3).trim();
    if (!file) continue;
    files.add(file);
    if (flag.includes("?")) untracked.add(file);
  }

  const data: DiffFile[] = [];
  for (const file of files) {
    if (untracked.has(file)) {
      data.push({
        file,
        status: "untracked",
        patch: "(untracked file; not committed and not included in the patch)",
      });
      continue;
    }
    const patch = [
      git(["diff", "HEAD^", "--", file], directory),
      git(["diff", "--", file], directory),
      git(["diff", "--cached", "--", file], directory),
    ]
      .filter(Boolean)
      .join("\n");
    if (patch) data.push({ file, status: "changed", patch });
  }

  return data;
}

/**
 * Returns the working-tree diff for the task's worker.
 * Staff worktree directory is authoritative because session.location may
 * report the project root.
 */
export async function taskDiff(
  ctx: Plugin.Context,
  store: SquadStore,
  task: Task,
): Promise<unknown> {
  let directory = ctx.location.directory;

  const staff = task.staffID ? store.getStaff(task.staffID) : undefined;
  if (staff?.worktreeDirectory) {
    directory = staff.worktreeDirectory as typeof directory;
    const data = worktreeDiff(directory);
    const head = git(["rev-parse", "HEAD"], directory).trim();
    const subject = git(["log", "-1", "--pretty=%s"], directory).trim();
    const dirty = git(["status", "--porcelain"], directory).trim();
    return {
      requested_directory: directory,
      location: { directory },
      source: "git-worktree",
      worktree: {
        directory,
        head,
        subject,
        dirty: dirty.length > 0,
      },
      data,
    };
  } else if (task.sessionID) {
    try {
      const info = await ctx.session.get({ sessionID: task.sessionID });
      directory = info.location.directory as typeof directory;
    } catch {
      // fall back to the plugin location
    }
  }

  const working = await ctx.vcs.diff({
    mode: "working",
    context: 3,
    location: { directory },
  });

  return {
    requested_directory: directory,
    location: working.location,
    source: "vcs",
    data: working.data,
  };
}
