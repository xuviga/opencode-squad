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
    expect(store.requireTask(mission.id, "t_001").status).toBe("ready");

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

  test("review fail returns the task, rework passes, mission is done", () => {
    const mission = store.createMission("Review mission");
    store.submitPlan(mission.id, plan);
    store.approvePlan(mission.id);
    const worker = hire();
    store.assignTask(mission.id, "t_001", worker.id, { goal: "Fix" });
    store.markTaskRunning(mission.id, "t_001");
    store.saveRawReport(mission.id, "t_001", '{"status":"done"}');
    store.completeTask(mission.id, "t_001", { status: "done" });

    const reviewer = store.hireStaff({
      persona: "reviewer",
      grade: "G3",
      agent: "squad-reviewer",
      provider: "deepseek",
      model: "deepseek-v4-pro",
      variant: "high",
      sessionID: "ses_review_1",
    });

    store.assignReview(mission.id, "t_001", reviewer.id, "ses_review_1");
    expect(store.requireTask(mission.id, "t_001").status).toBe("in_review");
    store.saveVerdict(mission.id, "t_001", {
      verdict: "fail",
      severity: "high",
      findings: [
        { id: "F1", claim: "missing", evidence: "report:1", required_fix: "add it" },
      ],
      checked: ["diff", "acceptance"],
    });
    expect(store.requireTask(mission.id, "t_001").status).toBe("returned");
    expect(store.requireMission(mission.id).status).toBe("executing");

    const rework = store.assignTask(mission.id, "t_001", worker.id, { goal: "Rework" });
    expect(rework.attempts).toBe(1);
    store.markTaskRunning(mission.id, "t_001");
    store.saveRawReport(mission.id, "t_001", '{"status":"done","summary":"fixed"}');
    store.completeTask(mission.id, "t_001", { status: "done", summary: "fixed" });

    store.assignReview(mission.id, "t_001", reviewer.id, "ses_review_2");
    store.saveVerdict(mission.id, "t_001", {
      verdict: "pass",
      severity: "low",
      findings: [],
      checked: ["diff", "tests", "acceptance"],
    });

    expect(store.requireTask(mission.id, "t_001").status).toBe("integrated");
    expect(store.requireMission(mission.id).status).toBe("integrating");
    expect(store.finalizeMission(mission.id).status).toBe("done");
    const score = store.scorecard(worker.id);
    expect(score.passAt1).toBe(0);
    expect(score.rework).toBe(1);
    expect(score.tasks).toBe(1);
  });

  test("appraises, clamps score, changes grade, and fires with evidence", () => {
    const staff = hire();
    expect(store.appraiseStaff(staff.id, 0.7, "good").score).toBeCloseTo(0.7);
    expect(store.appraiseStaff(staff.id, 0.7, "great").score).toBe(1);
    expect(store.listAppraisals(staff.id)).toHaveLength(2);

    expect(store.changeGrade(staff.id, "up").grade).toBe("G3");
    expect(store.changeGrade(staff.id, "down").grade).toBe("G2");

    expect(() => store.fireStaff(staff.id, "bad work", "")).toThrow("evidence_ref");
    const fired = store.fireStaff(staff.id, "bad work", "verdict:F1");
    expect(fired.status).toBe("fired");
    expect(store.isBlacklisted("implementer", "G2")).toBe(true);
    expect(store.isBlacklisted("implementer", "G3")).toBe(false);
    expect(store.countBlacklist()).toBe(1);
  });

  test("enforces DAG readiness and opens dependents after integration", () => {
    const mission = store.createMission("DAG mission");
    store.submitPlan(mission.id, {
      goal: "DAG",
      tasks: [
        {
          id: "t_001",
          title: "First",
          class: "code",
          role: "implementer",
          grade: "G2",
          acceptance: ["first done"],
        },
        {
          id: "t_002",
          title: "Second",
          class: "code",
          role: "implementer",
          grade: "G2",
          acceptance: ["second done"],
          dependsOn: ["t_001"],
        },
      ],
    });
    store.approvePlan(mission.id);
    const worker = hire();
    const reviewer = store.hireStaff({
      persona: "reviewer",
      grade: "G3",
      agent: "squad-reviewer",
      provider: "deepseek",
      model: "deepseek-v4-pro",
      variant: "high",
      sessionID: "ses_review_dag",
    });

    expect(store.requireTask(mission.id, "t_001").status).toBe("ready");
    expect(store.requireTask(mission.id, "t_002").status).toBe("pending");
    expect(() => store.assignTask(mission.id, "t_002", worker.id, {})).toThrow("not ready");

    store.assignTask(mission.id, "t_001", worker.id, { goal: "First" });
    store.markTaskRunning(mission.id, "t_001");
    store.saveRawReport(mission.id, "t_001", '{"status":"done"}');
    store.completeTask(mission.id, "t_001", { status: "done" });
    store.assignReview(mission.id, "t_001", reviewer.id, "ses_review_dag");
    store.saveVerdict(mission.id, "t_001", {
      verdict: "pass",
      severity: "low",
      findings: [],
      checked: ["diff", "tests", "acceptance"],
    });

    expect(store.requireTask(mission.id, "t_001").status).toBe("integrated");
    expect(store.requireTask(mission.id, "t_002").status).toBe("ready");
    expect(store.requireMission(mission.id).status).toBe("executing");
    expect(store.assignTask(mission.id, "t_002", worker.id, { goal: "Second" }).status).toBe(
      "assigned",
    );
  });

  test("flags budget anomaly above 3x expected", () => {
    const mission = store.createMission("Budget anomaly");
    store.submitPlan(mission.id, plan);
    store.approvePlan(mission.id);
    store.recordLedger({ missionID: mission.id, cost: 0.04 });
    const budget = store.budgetSummary(mission.id);
    expect(budget.actualCostUsd).toBeCloseTo(0.04);
    expect(budget.ratio).toBeCloseTo(4);
    expect(budget.anomaly).toBe(true);
    expect(budget.warnings).toContain("more than 3x expected");
  });
});
