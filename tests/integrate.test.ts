import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { integrateWorktree } from "../src/runtime/integrate";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
}

let root: string;
let main: string;
let worktree: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "squad-integrate-"));
  main = join(root, "main");
  worktree = join(root, "wt");
  mkdirSync(main);
  git(main, ["init", "-b", "main"]);
  git(main, ["config", "user.email", "test@example.com"]);
  git(main, ["config", "user.name", "SQUAD Test"]);
  writeFileSync(join(main, "file.txt"), "base\n");
  git(main, ["add", "."]);
  git(main, ["commit", "-m", "base"]);

  git(main, ["worktree", "add", "-b", "worker", worktree]);
  writeFileSync(join(worktree, "file.txt"), "theirs\n");
  git(worktree, ["commit", "-am", "worker change"]);

  writeFileSync(join(main, "file.txt"), "ours\n");
  git(main, ["commit", "-am", "main change"]);
});

afterEach(() => {
  try {
    git(main, ["worktree", "remove", "--force", worktree]);
  } catch {
    // best effort
  }
  rmSync(root, { recursive: true, force: true });
});

function readText(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("integrateWorktree", () => {
  test("abort strategy refuses a conflict and leaves main clean", () => {
    expect(() => integrateWorktree(main, worktree)).toThrow("cherry-pick failed");
    expect(readText(join(main, "file.txt"))).toBe("ours\n");
    expect(git(main, ["status", "--porcelain"]).trim()).toBe("");
  });

  test("theirs strategy resolves the conflict toward the worker", () => {
    const result = integrateWorktree(main, worktree, { strategy: "theirs" });
    expect(result.strategy).toBe("theirs");
    expect(result.alreadyMerged).toBe(false);
    expect(readText(join(main, "file.txt"))).toBe("theirs\n");
    expect(git(main, ["status", "--porcelain"]).trim()).toBe("");
  });
});
