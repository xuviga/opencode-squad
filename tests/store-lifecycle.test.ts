import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";

let directory: string;
let db: Database;
let store: SquadStore;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "squad-lifecycle-"));
  db = openSquadDb(directory);
  store = new SquadStore(db);
});

afterEach(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

function backdate(missionID: string, minutes: number): void {
  const stamp = new Date(Date.now() - minutes * 60_000).toISOString();
  db.query("UPDATE missions SET updated_at = ? WHERE id = ?").run(stamp, missionID);
}

describe("mission janitor state", () => {
  test("reports only non-terminal missions older than the window", () => {
    const stale = store.createMission("stale", "");
    const fresh = store.createMission("fresh", "");
    backdate(stale.id, 180);

    const found = store.listStaleMissions(120).map((mission) => mission.id);
    expect(found).toContain(stale.id);
    expect(found).not.toContain(fresh.id);
    expect(store.countStaleMissions(120)).toBe(1);
  });

  test("terminal missions are never stale", () => {
    const mission = store.createMission("aborted", "");
    store.abortMission(mission.id, "test");
    backdate(mission.id, 10_000);
    expect(store.listStaleMissions(60)).toHaveLength(0);
  });

  test("abort releases pending tasks", () => {
    const mission = store.createMission("pending", "");
    store.submitPlan(mission.id, {
      goal: "g",
      tasks: [
        {
          id: "t1",
          title: "one",
          class: "code",
          role: "implementer",
          grade: "G2",
          acceptance: ["ok"],
          dependsOn: ["t0"],
        },
      ],
    });
    expect(store.requireTask(mission.id, "t1").status).toBe("pending");
    store.abortMission(mission.id, "stale");
    expect(store.requireTask(mission.id, "t1").status).toBe("cancelled");
  });
});

describe("worktree bookkeeping", () => {
  test("missions default to worktree isolation", () => {
    expect(store.createMission("default", "").isolation).toBe("worktree");
  });

  test("in-place mission persists isolation and merges without a commit", () => {
    const mission = store.createMission("in place", "", "none");
    expect(store.requireMission(mission.id).isolation).toBe("none");

    store.submitPlan(mission.id, {
      goal: "g",
      tasks: [
        {
          id: "t1",
          title: "one",
          class: "code",
          role: "implementer",
          grade: "G1",
          acceptance: ["ok"],
        },
      ],
    });
    store.approvePlan(mission.id);
    const staff = store.hireStaff({
      persona: "implementer",
      grade: "G1",
      agent: "build",
      provider: "deepseek",
      model: "deepseek-flash",
      variant: "low",
      sessionID: "ses_test",
    });
    store.assignTask(mission.id, "t1", staff.id, { goal: "g" });
    store.saveRawReport(mission.id, "t1", "{}");
    store.assignReview(mission.id, "t1", staff.id, "ses_reviewer");
    store.saveVerdict(mission.id, "t1", { verdict: "pass" });

    const merged = store.markMergedInPlace(mission.id, "t1");
    expect(merged.status).toBe("integrated");
    expect(merged.mergedAt).not.toBeNull();
    expect(merged.integrationCommit).toBeNull();
  });

  test("setTaskSnapshot records the baseline directory", () => {
    const mission = store.createMission("snapshot", "");
    store.submitPlan(mission.id, {
      goal: "g",
      tasks: [
        {
          id: "t1",
          title: "one",
          class: "code",
          role: "implementer",
          grade: "G1",
          acceptance: ["ok"],
        },
      ],
    });
    const task = store.setTaskSnapshot(mission.id, "t1", "C:/tmp/snapshot");
    expect(task.snapshotDirectory).toBe("C:/tmp/snapshot");
  });
  test("clearWorktree forgets a removed directory", () => {
    const staff = store.hireStaff({
      persona: "implementer",
      grade: "G2",
      agent: "build",
      provider: "deepseek",
      model: "deepseek-flash",
      variant: "high",
      sessionID: "ses_test",
      worktreeDirectory: "C:/tmp/worktree",
    });
    expect(store.listStaffWithWorktrees().map((row) => row.id)).toContain(staff.id);

    const cleared = store.clearWorktree(staff.id);
    expect(cleared.worktreeDirectory).toBeNull();
    expect(store.listStaffWithWorktrees()).toHaveLength(0);
  });

  test("listTasksByStaff returns every task of the employee", () => {
    const mission = store.createMission("tasks", "");
    store.submitPlan(mission.id, {
      goal: "g",
      tasks: [
        {
          id: "t1",
          title: "one",
          class: "code",
          role: "implementer",
          grade: "G2",
          acceptance: ["ok"],
        },
      ],
    });
    store.approvePlan(mission.id);
    const staff = store.hireStaff({
      persona: "implementer",
      grade: "G2",
      agent: "build",
      provider: "deepseek",
      model: "deepseek-flash",
      variant: "high",
      sessionID: "ses_test",
    });
    store.assignTask(mission.id, "t1", staff.id, { goal: "g" });

    expect(store.listTasksByStaff(staff.id).map((task) => task.id)).toEqual(["t1"]);
  });
});
