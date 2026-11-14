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
  directory = mkdtempSync(join(tmpdir(), "squad-store-"));
  db = openSquadDb(directory);
  store = new SquadStore(db);
});

afterEach(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

const plan = {
  goal: "Ship a fix",
  expectedCostUsd: 0.01,
  tasks: [
    {
      id: "t_001",
      title: "Fix pagination",
      class: "code" as const,
      role: "implementer",
      grade: "G2" as const,
      acceptance: ["page 2 works"],
    },
  ],
};

function hire() {
  return store.hireStaff({
    persona: "implementer",
    grade: "G2",
    agent: "build",
    provider: "deepseek",
    model: "deepseek-flash",
    variant: "high",
    sessionID: "ses_test",
  });
}

describe("SquadStore", () => {
  test("runs mission → plan → approve → assign → submit", () => {
    const mission = store.createMission("Test mission", "Test goal");
    expect(mission.status).toBe("draft");

    const submitted = store.submitPlan(mission.id, plan);
    expect(submitted.version).toBe(1);
    expect(store.requireMission(mission.id).status).toBe("plan_gate");
    expect(store.listTasks(mission.id)).toHaveLength(1);
    expect(store.requireTask(mission.id, "t_001").status).toBe("pending");

    store.approvePlan(mission.id, "ok");
    expect(store.requireMission(mission.id).status).toBe("staffing");

    const staff = hire();
    const assigned = store.assignTask(mission.id, "t_001", staff.id, { goal: "Fix" });
    expect(assigned.status).toBe("assigned");
    expect(store.requireMission(mission.id).status).toBe("executing");

    expect(store.markTaskRunning(mission.id, "t_001").status).toBe("running");
    const submittedTask = store.saveRawReport(mission.id, "t_001", '{"status":"done"}');
    expect(submittedTask.status).toBe("submitted");
    expect(store.requireMission(mission.id).status).toBe("reviewing");

    const completed = store.completeTask(mission.id, "t_001", { status: "done" });
    expect(completed.status).toBe("submitted");
    expect(completed.report).toEqual({ status: "done" });
  });

  test("records per-task ledger and budget", () => {
    const mission = store.createMission("Budget mission");
    store.submitPlan(mission.id, plan);
    store.approvePlan(mission.id);

    store.recordLedger({
      missionID: mission.id,
      taskID: "t_001",
      provider: "deepseek",
      model: "deepseek-flash",
      variant: "high",
      inputTokens: 1000,
      outputTokens: 100,
      cost: 0.0005,
    });

    const budget = store.budgetSummary(mission.id);
    expect(budget.actualCostUsd).toBeCloseTo(0.0005);
    expect(budget.entries).toBe(1);
    expect(store.requireMission(mission.id).actualCostUsd).toBeCloseTo(0.0005);
  });

  test("allows reassigning a failed task", () => {
    const mission = store.createMission("Reassign mission");
    store.submitPlan(mission.id, plan);
    store.approvePlan(mission.id);
    const staff = hire();

    store.assignTask(mission.id, "t_001", staff.id, { goal: "Fix" });
    store.markTaskRunning(mission.id, "t_001");
    store.failTask(mission.id, "t_001", "timeout");
    expect(store.requireTask(mission.id, "t_001").status).toBe("failed");

    const reassigned = store.assignTask(mission.id, "t_001", staff.id, { goal: "Retry" });
    expect(reassigned.status).toBe("assigned");
    expect(reassigned.attempts).toBe(0);
  });

  test("enforces plan gate and task status transitions", () => {
    const mission = store.createMission("Guard mission");
    expect(() => store.approvePlan(mission.id)).toThrow("cannot approve plan");
    store.submitPlan(mission.id, plan);
    expect(() => store.submitPlan(mission.id, plan)).not.toThrow();
    store.approvePlan(mission.id);
    expect(() => store.submitPlan(mission.id, plan)).toThrow("cannot submit plan");
  });
});
