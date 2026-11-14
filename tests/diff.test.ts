import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";
import { taskDiff } from "../src/runtime/diff";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
}

let repo: string;
let dbDir: string;
let store: SquadStore;
let db: ReturnType<typeof openSquadDb>;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "squad-diff-"));
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  git(repo, ["config", "user.name", "SQUAD Test"]);
  writeFileSync(join(repo, "base.txt"), "base\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "base"]);
  writeFileSync(join(repo, "poster.svg"), "<svg/>\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "squad(t1): poster"]);

  dbDir = mkdtempSync(join(tmpdir(), "squad-diff-db-"));
  db = openSquadDb(dbDir);
  store = new SquadStore(db);
});

afterEach(() => {
  db.close();
  rmSync(repo, { recursive: true, force: true });
  rmSync(dbDir, { recursive: true, force: true });
});

describe("taskDiff", () => {
  test("returns worktree head metadata and the committed patch", async () => {
    const mission = store.createMission("Diff", "Diff metadata");
    store.submitPlan(mission.id, {
      goal: "Diff metadata",
      tasks: [
        {
          id: "t1",
          title: "Poster",
          class: "design",
          role: "designer",
          grade: "G2",
          acceptance: ["done"],
        },
      ],
    });
    store.approvePlan(mission.id);
    const staff = store.hireStaff({
      persona: "designer",
      grade: "G2",
      agent: "build",
      provider: "deepseek",
      model: "deepseek-flash",
      variant: "high",
      sessionID: "ses_designer",
      worktreeDirectory: repo,
    });
    store.assignTask(mission.id, "t1", staff.id, { goal: "poster" });
    const task = store.markTaskRunning(mission.id, "t1");

    const diff = (await taskDiff({ location: { directory: repo } } as never, store, task)) as {
      source: string;
      worktree: { head: string; subject: string; dirty: boolean };
      data: Array<{ file: string; patch: string }>;
    };

    expect(diff.source).toBe("git-worktree");
    expect(diff.worktree.head).toHaveLength(40);
    expect(diff.worktree.subject).toBe("squad(t1): poster");
    expect(diff.worktree.dirty).toBe(false);
    expect(diff.data.some((entry) => entry.file === "poster.svg")).toBe(true);
    expect(diff.data.find((entry) => entry.file === "poster.svg")?.patch).toContain("<svg/>");
  });
});
