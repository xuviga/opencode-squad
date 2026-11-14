import { describe, expect, test } from "bun:test";
import type { Mission, Staff, Task } from "../src/db/model";
import { planWorktreeSweep } from "../src/runtime/gc";

function staff(id: string, worktree: string | null): Staff {
  return {
    id,
    persona: "implementer",
    grade: "G2",
    agent: "build",
    provider: "deepseek",
    model: "deepseek-flash",
    variant: "high",
    sessionID: `ses_${id}`,
    worktreeDirectory: worktree,
    score: 0,
    status: "active",
    reason: null,
    firedAt: null,
    evidenceRef: null,
    createdAt: "",
    updatedAt: "",
  };
}

function task(id: string, missionID: string): Task {
  return {
    id,
    missionID,
    title: id,
    class: "code",
    role: "implementer",
    grade: "G2",
    status: "integrated",
    acceptance: [],
    dependsOn: [],
    capabilities: [],
    staffID: "s_1",
    sessionID: null,
    assignedAt: null,
    reviewerStaffID: null,
    reviewerSessionID: null,
    reviewRound: 1,
    brief: null,
    report: null,
    verdict: null,
    rawReport: null,
    reportCapturedAt: null,
    snapshotDirectory: null,
    mergedAt: null,
    integrationCommit: null,
    attempts: 0,
    createdAt: "",
    updatedAt: "",
  };
}

function mission(id: string, status: Mission["status"]): Mission {
  return {
    id,
    title: id,
    goal: "",
    status,
    isolation: "worktree",
    planVersion: 1,
    expectedCostUsd: null,
    actualCostUsd: 0,
    createdAt: "",
    updatedAt: "",
    approvedAt: null,
  };
}

describe("planWorktreeSweep", () => {
  test("keeps worktrees of live missions", () => {
    const plan = planWorktreeSweep({
      staff: [staff("s_1", "/wt")],
      tasksByStaff: new Map([["s_1", [task("t1", "m_live")]]]),
      missions: new Map([["m_live", mission("m_live", "executing")]]),
      staleMissionIDs: new Set(),
    });
    expect(plan).toHaveLength(0);
  });

  test("removes worktrees of terminal missions", () => {
    const plan = planWorktreeSweep({
      staff: [staff("s_1", "/wt")],
      tasksByStaff: new Map([["s_1", [task("t1", "m_done")]]]),
      missions: new Map([["m_done", mission("m_done", "done")]]),
      staleMissionIDs: new Set(),
    });
    expect(plan).toEqual([
      {
        staffID: "s_1",
        persona: "implementer",
        directory: "/wt",
        missionIDs: ["m_done"],
        reason: "mission_terminal",
      },
    ]);
  });

  test("removes worktrees of stale missions", () => {
    const plan = planWorktreeSweep({
      staff: [staff("s_1", "/wt")],
      tasksByStaff: new Map([["s_1", [task("t1", "m_stale")]]]),
      missions: new Map([["m_stale", mission("m_stale", "staffing")]]),
      staleMissionIDs: new Set(["m_stale"]),
    });
    expect(plan[0]?.reason).toBe("mission_stale");
  });

  test("removes worktrees without tasks or with a missing mission", () => {
    const plan = planWorktreeSweep({
      staff: [staff("s_1", "/wt"), staff("s_2", "/wt2")],
      tasksByStaff: new Map([["s_2", [task("t1", "m_gone")]]]),
      missions: new Map(),
      staleMissionIDs: new Set(),
    });
    expect(plan.map((candidate) => candidate.reason).sort()).toEqual([
      "mission_missing",
      "no_tasks",
    ]);
  });

  test("ignores staff without a worktree", () => {
    const plan = planWorktreeSweep({
      staff: [staff("s_1", null)],
      tasksByStaff: new Map(),
      missions: new Map(),
      staleMissionIDs: new Set(),
    });
    expect(plan).toHaveLength(0);
  });
});
