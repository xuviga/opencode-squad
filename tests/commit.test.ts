import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitWorktree } from "../src/runtime/commit";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
}

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "squad-commit-"));
  git(directory, ["init", "-b", "main"]);
  git(directory, ["config", "user.email", "test@example.com"]);
  git(directory, ["config", "user.name", "SQUAD Test"]);
  writeFileSync(join(directory, "base.txt"), "base\n");
  git(directory, ["add", "."]);
  git(directory, ["commit", "-m", "base"]);
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("commitWorktree", () => {
  test("commits dirty worktree changes on behalf of a shell-less writer", () => {
    writeFileSync(join(directory, "poster.svg"), "<svg/>\n");
    const result = commitWorktree(directory, "squad(t1): poster");
    expect(result.committed).toBe(true);
    expect(result.files).toBe(1);
    expect(result.commit).toHaveLength(40);
    expect(git(directory, ["status", "--porcelain"]).trim()).toBe("");
    expect(git(directory, ["log", "-1", "--pretty=%s"]).trim()).toBe("squad(t1): poster");
  });

  test("does nothing when the worktree is clean", () => {
    const result = commitWorktree(directory, "squad(t1): poster");
    expect(result.committed).toBe(false);
    expect(result.commit).toBeNull();
    expect(result.files).toBe(0);
  });
});
