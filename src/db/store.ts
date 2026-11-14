import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import type { MissionPlan } from "../plan";

export const MISSION_STATUSES = [
  "draft",
  "planning",
  "plan_gate",
  "staffing",
  "executing",
  "reviewing",
  "integrating",
  "done",
  "failed",
  "aborted",
] as const;

export type MissionStatus = (typeof MISSION_STATUSES)[number];

export type Mission = {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  planVersion: number;
  expectedCostUsd: number | null;
  actualCostUsd: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

export type Staff = {
  id: string;
  persona: string;
  grade: string;
  agent: string | null;
  provider: string | null;
  model: string | null;
  variant: string | null;
  sessionID: string | null;
  worktreeDirectory: string | null;
  score: number;
  status: string;
  reason: string | null;
  firedAt: string | null;
  evidenceRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  missionID: string;
  title: string;
  class: string;
  role: string;
  grade: string;
  status: string;
  acceptance: string[];
  dependsOn: string[];
  staffID: string | null;
  sessionID: string | null;
  assignedAt: string | null;
  reviewerStaffID: string | null;
  reviewerSessionID: string | null;
  reviewRound: number;
  brief: unknown;
  report: unknown;
  verdict: unknown;
  rawReport: string | null;
  reportCapturedAt: string | null;
  mergedAt: string | null;
  integrationCommit: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export type Dispute = {
  id: string;
  missionID: string;
  taskID: string;
  status: string;
  round: number;
  claim: string;
  evidence: unknown;
  ruling: unknown;
  createdAt: string;
  updatedAt: string;
};

export type DisputeMessage = {
  id: number;
  disputeID: string;
  role: string;
  text: string;
  evidence: unknown;
  createdAt: string;
};

export type Audit = {
  id: string;
  missionID: string;
  taskID: string;
  kind: string;
  status: string;
  reviewerStaffID: string | null;
  reviewerSessionID: string | null;
  verdict: unknown;
  notes: string | null;
  createdAt: string;
};

export type Lesson = {
  id: number;
  missionID: string | null;
  taskID: string | null;
  text: string;
  tags: string[];
  createdAt: string;
};

export type LedgerInput = {
  missionID?: string | null;
  taskID?: string | null;
  staffID?: string | null;
  sessionID?: string | null;
  provider?: string | null;
  model?: string | null;
  variant?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
};

type MissionRow = {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  plan_json: string | null;
  plan_version: number;
  expected_cost_usd: number | null;
  actual_cost_usd: number;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
};

type StaffRow = {
  id: string;
  persona: string;
  grade: string;
  agent: string | null;
  provider: string | null;
  model: string | null;
  variant: string | null;
  session_id: string | null;
  worktree_directory: string | null;
  score: number;
  status: string;
  reason: string | null;
  fired_at: string | null;
  evidence_ref: string | null;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  mission_id: string;
  id: string;
  title: string;
  class: string;
  role: string;
  grade: string;
  status: string;
  acceptance_json: string;
  depends_on_json: string;
  staff_id: string | null;
  session_id: string | null;
  assigned_at: string | null;
  reviewer_staff_id: string | null;
  reviewer_session_id: string | null;
  review_round: number;
  brief_json: string | null;
  report_json: string | null;
  verdict_json: string | null;
  raw_report: string | null;
  report_captured_at: string | null;
  merged_at: string | null;
  integration_commit: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
};

type DisputeRow = {
  id: string;
  mission_id: string;
  task_id: string;
  status: string;
  round: number;
  claim: string;
  evidence_json: string | null;
  ruling_json: string | null;
  created_at: string;
  updated_at: string;
};

type DisputeMessageRow = {
  id: number;
  dispute_id: string;
  role: string;
  text: string;
  evidence_json: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  mission_id: string;
  task_id: string;
  kind: string;
  status: string;
  reviewer_staff_id: string | null;
  reviewer_session_id: string | null;
  verdict_json: string | null;
  notes: string | null;
  created_at: string;
};

type LessonRow = {
  id: number;
  mission_id: string | null;
  task_id: string | null;
  text: string;
  tags_json: string | null;
  created_at: string;
};

function missionID(): string {
  return `m_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

function mapMission(row: MissionRow): Mission {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    status: row.status,
    planVersion: row.plan_version,
    expectedCostUsd: row.expected_cost_usd,
    actualCostUsd: row.actual_cost_usd,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
  };
}

function parseJSON<T>(text: string | null): T | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function mapStaff(row: StaffRow): Staff {
  return {
    id: row.id,
    persona: row.persona,
    grade: row.grade,
    agent: row.agent,
    provider: row.provider,
    model: row.model,
    variant: row.variant,
    sessionID: row.session_id,
    worktreeDirectory: row.worktree_directory,
    score: row.score,
    status: row.status,
    reason: row.reason,
    firedAt: row.fired_at,
    evidenceRef: row.evidence_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    missionID: row.mission_id,
    title: row.title,
    class: row.class,
    role: row.role,
    grade: row.grade,
    status: row.status,
    acceptance: parseJSON<string[]>(row.acceptance_json) ?? [],
    dependsOn: parseJSON<string[]>(row.depends_on_json) ?? [],
    staffID: row.staff_id,
    sessionID: row.session_id,
    assignedAt: row.assigned_at,
    reviewerStaffID: row.reviewer_staff_id,
    reviewerSessionID: row.reviewer_session_id,
    reviewRound: row.review_round,
    brief: parseJSON<unknown>(row.brief_json),
    report: parseJSON<unknown>(row.report_json),
    verdict: parseJSON<unknown>(row.verdict_json),
    rawReport: row.raw_report,
    reportCapturedAt: row.report_captured_at,
    mergedAt: row.merged_at,
    integrationCommit: row.integration_commit,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDispute(row: DisputeRow): Dispute {
  return {
    id: row.id,
    missionID: row.mission_id,
    taskID: row.task_id,
    status: row.status,
    round: row.round,
    claim: row.claim,
    evidence: parseJSON<unknown>(row.evidence_json),
    ruling: parseJSON<unknown>(row.ruling_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDisputeMessage(row: DisputeMessageRow): DisputeMessage {
  return {
    id: row.id,
    disputeID: row.dispute_id,
    role: row.role,
    text: row.text,
    evidence: parseJSON<unknown>(row.evidence_json),
    createdAt: row.created_at,
  };
}

function mapAudit(row: AuditRow): Audit {
  return {
    id: row.id,
    missionID: row.mission_id,
    taskID: row.task_id,
    kind: row.kind,
    status: row.status,
    reviewerStaffID: row.reviewer_staff_id,
    reviewerSessionID: row.reviewer_session_id,
    verdict: parseJSON<unknown>(row.verdict_json),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapLesson(row: LessonRow): Lesson {
  return {
    id: row.id,
    missionID: row.mission_id,
    taskID: row.task_id,
    text: row.text,
    tags: parseJSON<string[]>(row.tags_json) ?? [],
    createdAt: row.created_at,
  };
}

export class SquadStore {
  constructor(private readonly db: Database) {}

  createMission(title: string, goal = ""): Mission {
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error("mission title must not be empty");
    const id = missionID();
    const timestamp = now();

    const create = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO missions (id, title, goal, status, created_at, updated_at)
           VALUES (?, ?, ?, 'draft', ?, ?)`,
        )
        .run(id, cleanTitle, goal.trim(), timestamp, timestamp);
      this.addEvent(id, null, "mission.created", { title: cleanTitle });
    });
    create();

    return this.requireMission(id);
  }

  listMissions(limit = 20): Mission[] {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const rows = this.db
      .query("SELECT * FROM missions ORDER BY updated_at DESC LIMIT ?")
      .all(safeLimit) as MissionRow[];
    return rows.map(mapMission);
  }

  getMission(id: string): Mission | undefined {
    const row = this.db.query("SELECT * FROM missions WHERE id = ?").get(id) as
      | MissionRow
      | undefined;
    return row ? mapMission(row) : undefined;
  }

  requireMission(id: string): Mission {
    const mission = this.getMission(id);
    if (!mission) throw new Error(`mission not found: ${id}`);
    return mission;
  }

  getPlan(id: string): MissionPlan | null {
    const row = this.db.query("SELECT plan_json FROM missions WHERE id = ?").get(id) as
      | { plan_json: string | null }
      | undefined;
    if (!row || !row.plan_json) return null;
    return JSON.parse(row.plan_json) as MissionPlan;
  }

  submitPlan(id: string, plan: MissionPlan): { mission: Mission; plan: MissionPlan; version: number } {
    const mission = this.requireMission(id);
    if (!["draft", "planning", "plan_gate"].includes(mission.status)) {
      throw new Error(`cannot submit plan in status ${mission.status}`);
    }

    const version = mission.planVersion + 1;
    const timestamp = now();
    const planJSON = JSON.stringify(plan);

    const submit = this.db.transaction(() => {
      this.db
        .query(
          `UPDATE missions
           SET status = 'plan_gate', plan_json = ?, plan_version = ?, expected_cost_usd = ?,
               approved_at = NULL, updated_at = ?
           WHERE id = ?`,
        )
        .run(planJSON, version, plan.expectedCostUsd ?? null, timestamp, id);

      this.db.query("DELETE FROM tasks WHERE mission_id = ?").run(id);

      const insertTask = this.db.query(
        `INSERT INTO tasks
         (mission_id, id, title, class, role, grade, status, acceptance_json, depends_on_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const task of plan.tasks) {
        insertTask.run(
          id,
          task.id,
          task.title,
          task.class,
          task.role,
          task.grade,
          task.dependsOn && task.dependsOn.length > 0 ? "pending" : "ready",
          JSON.stringify(task.acceptance),
          JSON.stringify(task.dependsOn ?? []),
          timestamp,
          timestamp,
        );
      }

      this.addEvent(id, null, "plan.submitted", {
        version,
        tasks: plan.tasks.length,
        expectedCostUsd: plan.expectedCostUsd ?? null,
      });
    });
    submit();

    return { mission: this.requireMission(id), plan, version };
  }

  approvePlan(id: string, note = ""): Mission {
    const mission = this.requireMission(id);
    if (mission.status !== "plan_gate") {
      throw new Error(`cannot approve plan in status ${mission.status}`);
    }
    const timestamp = now();
    const approve = this.db.transaction(() => {
      this.db
        .query(
          `UPDATE missions
           SET status = 'staffing', approved_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(timestamp, timestamp, id);
      this.addEvent(id, null, "plan.approved", { note });
    });
    approve();
    return this.requireMission(id);
  }

  rejectPlan(id: string, note = ""): Mission {
    const mission = this.requireMission(id);
    if (mission.status !== "plan_gate") {
      throw new Error(`cannot reject plan in status ${mission.status}`);
    }
    const timestamp = now();
    const reject = this.db.transaction(() => {
      this.db
        .query(
          `UPDATE missions
           SET status = 'draft', approved_at = NULL, updated_at = ?
           WHERE id = ?`,
        )
        .run(timestamp, id);
      this.addEvent(id, null, "plan.rejected", { note });
    });
    reject();
    return this.requireMission(id);
  }

  hireStaff(input: {
    persona: string;
    grade: string;
    agent: string;
    provider: string;
    model: string;
    variant: string;
    sessionID: string;
    worktreeDirectory?: string | null;
  }): Staff {
    const id = `s_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const timestamp = now();
    const hire = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO staff
           (id, persona, grade, agent, provider, model, variant, session_id, worktree_directory, score, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, ?)`,
        )
        .run(
          id,
          input.persona,
          input.grade,
          input.agent,
          input.provider,
          input.model,
          input.variant,
          input.sessionID,
          input.worktreeDirectory ?? null,
          timestamp,
          timestamp,
        );
      this.addEvent(null, null, "staff.hired", {
        staffID: id,
        persona: input.persona,
        grade: input.grade,
        agent: input.agent,
        sessionID: input.sessionID,
      });
    });
    hire();
    return this.requireStaff(id);
  }

  listStaff(limit = 50): Staff[] {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
    const rows = this.db
      .query("SELECT * FROM staff ORDER BY updated_at DESC LIMIT ?")
      .all(safeLimit) as StaffRow[];
    return rows.map(mapStaff);
  }

  getStaff(id: string): Staff | undefined {
    const row = this.db.query("SELECT * FROM staff WHERE id = ?").get(id) as StaffRow | undefined;
    return row ? mapStaff(row) : undefined;
  }

  requireStaff(id: string): Staff {
    const staff = this.getStaff(id);
    if (!staff) throw new Error(`staff not found: ${id}`);
    return staff;
  }

  listTasks(missionID: string): Task[] {
    const rows = this.db
      .query("SELECT * FROM tasks WHERE mission_id = ? ORDER BY created_at ASC")
      .all(missionID) as TaskRow[];
    return rows.map(mapTask);
  }

  getTask(missionID: string, taskID: string): Task | undefined {
    const row = this.db
      .query("SELECT * FROM tasks WHERE mission_id = ? AND id = ?")
      .get(missionID, taskID) as TaskRow | undefined;
    return row ? mapTask(row) : undefined;
  }

  requireTask(missionID: string, taskID: string): Task {
    const task = this.getTask(missionID, taskID);
    if (!task) throw new Error(`task not found: ${missionID}/${taskID}`);
    return task;
  }

  assignTask(missionID: string, taskID: string, staffID: string, brief: unknown): Task {
    const mission = this.requireMission(missionID);
    if (!["staffing", "executing"].includes(mission.status)) {
      throw new Error(`cannot assign task in mission status ${mission.status}`);
    }
    const task = this.requireTask(missionID, taskID);
    if (!["ready", "failed", "returned"].includes(task.status)) {
      throw new Error(
        task.status === "pending"
          ? `task is not ready; dependencies are not integrated: ${taskID}`
          : `cannot assign task in status ${task.status}`,
      );
    }
    for (const dependency of task.dependsOn) {
      const dependencyTask = this.requireTask(missionID, dependency);
      if (dependencyTask.status !== "integrated") {
        throw new Error(`dependency not integrated: ${dependency}`);
      }
    }
    const staff = this.requireStaff(staffID);
    if (staff.status !== "active") throw new Error(`staff is not active: ${staffID}`);
    if (!staff.sessionID) throw new Error(`staff has no session: ${staffID}`);

    const nextAttempts = task.status === "returned" ? task.attempts + 1 : task.attempts;
    if (nextAttempts > 2) {
      const timestamp = now();
      this.db
        .query(
          `UPDATE tasks SET status = 'escalated', updated_at = ?
           WHERE mission_id = ? AND id = ?`,
        )
        .run(timestamp, missionID, taskID);
      this.addEvent(missionID, taskID, "task.escalated", {
        reason: "rework limit exceeded",
        attempts: task.attempts,
      });
      throw new Error(`rework limit exceeded for task ${taskID}`);
    }

    const timestamp = now();
    const assign = this.db.transaction(() => {
      this.db
        .query(
          `UPDATE tasks
           SET status = 'assigned', staff_id = ?, session_id = ?, brief_json = ?,
               assigned_at = ?, attempts = ?, updated_at = ?
           WHERE mission_id = ? AND id = ?`,
        )
        .run(
          staffID,
          staff.sessionID,
          JSON.stringify(brief),
          timestamp,
          nextAttempts,
          timestamp,
          missionID,
          taskID,
        );
      this.db
        .query(
          `UPDATE missions
           SET status = CASE WHEN status = 'staffing' THEN 'executing' ELSE status END,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(timestamp, missionID);
      this.addEvent(missionID, taskID, "task.assigned", {
        staffID,
        sessionID: staff.sessionID,
      });
    });
    assign();
    return this.requireTask(missionID, taskID);
  }

  markTaskRunning(missionID: string, taskID: string): Task {
    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks SET status = 'running', updated_at = ?
         WHERE mission_id = ? AND id = ?`,
      )
      .run(timestamp, missionID, taskID);
    this.addEvent(missionID, taskID, "task.running", {});
    return this.requireTask(missionID, taskID);
  }

  saveRawReport(missionID: string, taskID: string, rawReport: string): Task {
    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks SET raw_report = ?, status = 'submitted', report_captured_at = ?, updated_at = ?
         WHERE mission_id = ? AND id = ?`,
      )
      .run(rawReport, timestamp, timestamp, missionID, taskID);
    this.addEvent(missionID, taskID, "report.captured", {
      chars: rawReport.length,
    });
    this.maybeAdvanceMission(missionID);
    return this.requireTask(missionID, taskID);
  }

  private maybeAdvanceMission(missionID: string): void {
    const mission = this.requireMission(missionID);
    if (mission.status !== "executing") return;
    const tasks = this.listTasks(missionID);
    if (tasks.length === 0) return;
    const allSubmitted = tasks.every((task) =>
      ["submitted", "in_review", "integrated"].includes(task.status),
    );
    if (!allSubmitted) return;
    this.db
      .query(
        `UPDATE missions SET status = 'reviewing', updated_at = ?
         WHERE id = ? AND status = 'executing'`,
      )
      .run(now(), missionID);
    this.addEvent(missionID, null, "mission.reviewing", {});
  }

  completeTask(missionID: string, taskID: string, report: unknown): Task {
    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks SET status = 'submitted', report_json = ?, updated_at = ?
         WHERE mission_id = ? AND id = ?`,
      )
      .run(JSON.stringify(report), timestamp, missionID, taskID);
    this.addEvent(missionID, taskID, "report.validated", {});
    return this.requireTask(missionID, taskID);
  }

  assignReview(
    missionID: string,
    taskID: string,
    reviewerStaffID: string,
    reviewerSessionID: string,
  ): Task {
    const task = this.requireTask(missionID, taskID);
    if (task.status !== "submitted") {
      throw new Error(`cannot review task in status ${task.status}`);
    }
    const timestamp = now();
    const assign = this.db.transaction(() => {
      this.db
        .query(
          `UPDATE tasks
           SET status = 'in_review', reviewer_staff_id = ?, reviewer_session_id = ?,
               review_round = review_round + 1, updated_at = ?
           WHERE mission_id = ? AND id = ?`,
        )
        .run(reviewerStaffID, reviewerSessionID, timestamp, missionID, taskID);
      this.db
        .query(
          `UPDATE missions SET status = 'reviewing', updated_at = ?
           WHERE id = ? AND status IN ('executing', 'staffing')`,
        )
        .run(timestamp, missionID);
      this.addEvent(missionID, taskID, "review.started", {
        reviewerStaffID,
        reviewerSessionID,
        round: task.reviewRound + 1,
      });
    });
    assign();
    return this.requireTask(missionID, taskID);
  }

  resetReview(missionID: string, taskID: string, reason: string): Task {
    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks
         SET status = 'submitted', reviewer_staff_id = NULL, reviewer_session_id = NULL,
             updated_at = ?
         WHERE mission_id = ? AND id = ? AND status = 'in_review'`,
      )
      .run(timestamp, missionID, taskID);
    this.addEvent(missionID, taskID, "review.reset", { reason });
    return this.requireTask(missionID, taskID);
  }

  saveVerdict(missionID: string, taskID: string, verdict: unknown): Task {
    const task = this.requireTask(missionID, taskID);
    if (task.status !== "in_review") {
      throw new Error(`cannot save verdict in task status ${task.status}`);
    }
    const outcome = (verdict as { verdict?: string } | null)?.verdict;
    if (outcome !== "pass" && outcome !== "fail") {
      throw new Error("verdict.verdict must be pass or fail");
    }
    const timestamp = now();
    const save = this.db.transaction(() => {
      this.db
        .query(
          `UPDATE tasks SET status = ?, verdict_json = ?, updated_at = ?
           WHERE mission_id = ? AND id = ?`,
        )
        .run(outcome === "pass" ? "integrated" : "returned", JSON.stringify(verdict), timestamp, missionID, taskID);

      if (outcome === "fail") {
        this.db
          .query(
            `UPDATE missions SET status = 'executing', updated_at = ?
             WHERE id = ? AND status = 'reviewing'`,
          )
          .run(timestamp, missionID);
        this.addEvent(missionID, taskID, "review.failed", {
          round: task.reviewRound,
        });
      } else {
        this.addEvent(missionID, taskID, "review.passed", {
          round: task.reviewRound,
        });
      }
    });
    save();
    this.advanceDependents(missionID);
    this.maybeFinishMission(missionID);
    return this.requireTask(missionID, taskID);
  }

  private advanceDependents(missionID: string): void {
    const tasks = this.listTasks(missionID);
    const integrated = new Set(
      tasks.filter((task) => task.status === "integrated").map((task) => task.id),
    );
    let advanced = false;
    for (const task of tasks) {
      if (task.status !== "pending") continue;
      if (!task.dependsOn.every((dependency) => integrated.has(dependency))) continue;
      this.db
        .query(
          `UPDATE tasks SET status = 'ready', updated_at = ?
           WHERE mission_id = ? AND id = ? AND status = 'pending'`,
        )
        .run(now(), missionID, task.id);
      this.addEvent(missionID, task.id, "task.ready", {});
      advanced = true;
    }
    if (advanced) {
      this.db
        .query(
          `UPDATE missions SET status = 'executing', updated_at = ?
           WHERE id = ? AND status = 'reviewing'`,
        )
        .run(now(), missionID);
    }
  }

  private maybeFinishMission(missionID: string): void {
    const mission = this.requireMission(missionID);
    if (mission.status !== "reviewing") return;
    const tasks = this.listTasks(missionID);
    if (tasks.length === 0) return;
    if (!tasks.every((task) => task.status === "integrated")) return;
    this.db
      .query(
        `UPDATE missions SET status = 'integrating', updated_at = ?
         WHERE id = ? AND status = 'reviewing'`,
      )
      .run(now(), missionID);
    this.addEvent(missionID, null, "mission.integrating", {});
  }

  markMerged(missionID: string, taskID: string, commit: string, sourceCommit?: string): Task {
    const task = this.requireTask(missionID, taskID);
    if (task.status !== "integrated") {
      throw new Error(`cannot merge task in status ${task.status}`);
    }
    if (!commit.trim()) throw new Error("integration commit is required");
    if (task.mergedAt) return task;
    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks SET merged_at = ?, integration_commit = ?, updated_at = ?
         WHERE mission_id = ? AND id = ?`,
      )
      .run(timestamp, commit.trim(), timestamp, missionID, taskID);
    this.addEvent(missionID, taskID, "integration.merged", {
      commit: commit.trim(),
      sourceCommit: sourceCommit?.trim() || null,
    });
    return this.requireTask(missionID, taskID);
  }

  finalizeMission(missionID: string): Mission {
    const mission = this.requireMission(missionID);
    if (mission.status !== "integrating") {
      throw new Error(`cannot finalize mission in status ${mission.status}`);
    }
    const tasks = this.listTasks(missionID);
    if (tasks.length === 0 || !tasks.every((task) => task.status === "integrated")) {
      throw new Error("cannot finalize: not all tasks are integrated");
    }

    const requiredAudits = Math.max(1, Math.ceil(tasks.length * 0.1));
    const auditRow = this.db
      .query(
        `SELECT COUNT(*) AS count FROM audits
         WHERE mission_id = ? AND kind = 'second_review'`,
      )
      .get(missionID) as { count: number };
    if (auditRow.count < requiredAudits) {
      throw new Error(
        `cannot finalize: requires ${requiredAudits} second-review audit(s), found ${auditRow.count}; run squad_audit`,
      );
    }

    for (const task of tasks) {
      if (task.mergedAt) continue;
      const staff = task.staffID ? this.getStaff(task.staffID) : undefined;
      if (staff?.worktreeDirectory) {
        throw new Error(`cannot finalize: worktree of ${task.id} is not merged; run squad_integrate`);
      }
    }

    this.db
      .query(
        `UPDATE missions SET status = 'done', updated_at = ?
         WHERE id = ? AND status = 'integrating'`,
      )
      .run(now(), missionID);
    this.addEvent(missionID, null, "mission.done", {});
    return this.requireMission(missionID);
  }

  listEvents(missionID: string, limit = 100) {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 500));
    return this.db
      .query(
        `SELECT id, mission_id, task_id, type, payload_json, created_at
         FROM events WHERE mission_id = ?
         ORDER BY id DESC LIMIT ?`,
      )
      .all(missionID, safeLimit) as Array<{
      id: number;
      mission_id: string | null;
      task_id: string | null;
      type: string;
      payload_json: string | null;
      created_at: string;
    }>;
  }

  countEvents(missionID: string): number {
    const row = this.db
      .query("SELECT COUNT(*) AS count FROM events WHERE mission_id = ?")
      .get(missionID) as { count: number };
    return row.count;
  }

  failTask(missionID: string, taskID: string, reason: string): Task {
    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks SET status = 'failed', updated_at = ?
         WHERE mission_id = ? AND id = ?`,
      )
      .run(timestamp, missionID, taskID);
    this.addEvent(missionID, taskID, "task.failed", { reason });
    return this.requireTask(missionID, taskID);
  }

  hasLedgerEntry(missionID: string, taskID: string, sessionID: string): boolean {
    const row = this.db
      .query(
        `SELECT COUNT(*) AS count FROM ledger
         WHERE mission_id = ? AND task_id = ? AND session_id = ?`,
      )
      .get(missionID, taskID, sessionID) as { count: number };
    return row.count > 0;
  }

  appraiseStaff(staffID: string, delta: number, note = ""): Staff {
    const staff = this.requireStaff(staffID);
    if (staff.status !== "active") throw new Error(`staff is not active: ${staffID}`);
    if (!Number.isFinite(delta)) throw new Error("appraisal delta must be a finite number");
    const nextScore = Math.max(0, Math.min(1, staff.score + delta));
    const timestamp = now();
    const appraise = this.db.transaction(() => {
      this.db
        .query("UPDATE staff SET score = ?, updated_at = ? WHERE id = ?")
        .run(nextScore, timestamp, staffID);
      this.db
        .query(
          `INSERT INTO appraisals (staff_id, delta, note, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(staffID, delta, note, timestamp);
      this.addEvent(null, null, "staff.appraised", { staffID, delta, note });
    });
    appraise();
    return this.requireStaff(staffID);
  }

  fireStaff(staffID: string, reason: string, evidenceRef: string): Staff {
    const staff = this.requireStaff(staffID);
    if (staff.status === "fired") throw new Error(`staff already fired: ${staffID}`);
    if (!reason.trim()) throw new Error("fire reason is required");
    if (!evidenceRef.trim()) throw new Error("fire evidence_ref is required");
    const timestamp = now();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const fire = this.db.transaction(() => {
      this.db
        .query(
          `UPDATE staff
           SET status = 'fired', reason = ?, evidence_ref = ?, fired_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(reason.trim(), evidenceRef.trim(), timestamp, timestamp, staffID);
      this.db
        .query(
          `INSERT INTO blacklist
           (persona, grade, reason, evidence_ref, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(staff.persona, staff.grade, reason.trim(), evidenceRef.trim(), timestamp, expiresAt);
      this.addEvent(null, null, "staff.fired", {
        staffID,
        persona: staff.persona,
        grade: staff.grade,
        reason: reason.trim(),
        evidenceRef: evidenceRef.trim(),
        blacklistedUntil: expiresAt,
      });
    });
    fire();
    return this.requireStaff(staffID);
  }

  isBlacklisted(persona: string, grade: string): boolean {
    const row = this.db
      .query(
        `SELECT 1 AS blocked FROM blacklist
         WHERE persona = ? AND grade = ? AND expires_at > ?
         LIMIT 1`,
      )
      .get(persona, grade, now()) as { blocked?: number } | undefined;
    return row?.blocked === 1;
  }

  listAppraisals(staffID: string, limit = 50) {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
    return this.db
      .query(
        `SELECT id, staff_id, delta, note, created_at
         FROM appraisals WHERE staff_id = ?
         ORDER BY id DESC LIMIT ?`,
      )
      .all(staffID, safeLimit) as Array<{
      id: number;
      staff_id: string;
      delta: number;
      note: string | null;
      created_at: string;
    }>;
  }

  scorecard(staffID: string) {
    const staff = this.requireStaff(staffID);
    const tasks = this.db
      .query("SELECT * FROM tasks WHERE staff_id = ?")
      .all(staffID) as TaskRow[];
    const total = tasks.length;
    if (total === 0) {
      return {
        staffID,
        staff: staff.persona,
        grade: staff.grade,
        tasks: 0,
        passAt1: 0,
        rework: 0,
        timeout: 0,
        disputeLoss: 0,
        costEfficiency: 1,
        score: 0.5,
        totalCostUsd: 0,
        recommendation: "insufficient_data",
      };
    }

    const passAt1 =
      tasks.filter((task) => task.status === "integrated" && task.attempts === 0).length / total;
    const rework =
      tasks.filter((task) => task.attempts > 0 || task.status === "returned").length / total;
    const timeout = tasks.filter((task) => task.status === "failed").length / total;
    const disputeLoss = 0;

    const costRows = this.db
      .query(
        `SELECT staff_id, COALESCE(SUM(cost), 0) AS total
         FROM ledger WHERE staff_id IS NOT NULL GROUP BY staff_id`,
      )
      .all() as Array<{ staff_id: string; total: number }>;
    const totalCost = costRows.find((row) => row.staff_id === staffID)?.total ?? 0;
    const costs = costRows
      .map((row) => row.total)
      .filter((cost) => cost > 0)
      .sort((a, b) => a - b);
    const medianCost = costs.length > 0 ? costs[Math.floor(costs.length / 2)]! : 0;
    const costEfficiency =
      totalCost <= 0 || medianCost <= 0 ? 1 : Math.min(1, medianCost / totalCost);

    const score = Math.max(
      0,
      Math.min(
        1,
        0.4 * passAt1 +
          0.2 * (1 - rework) +
          0.15 * (1 - disputeLoss) +
          0.15 * costEfficiency +
          0.1 * (1 - timeout),
      ),
    );

    const failed = tasks.filter((task) => task.status === "failed").length;
    const recommendation =
      failed >= 2 ? "fire" : score >= 0.85 && total >= 5 ? "promote" : score <= 0.4 ? "demote" : "hold";

    return {
      staffID,
      staff: staff.persona,
      grade: staff.grade,
      tasks: total,
      passAt1,
      rework,
      timeout,
      disputeLoss,
      costEfficiency,
      score,
      totalCostUsd: totalCost,
      medianCostUsd: medianCost,
      recommendation,
    };
  }

  changeGrade(staffID: string, direction: "up" | "down"): Staff {
    const staff = this.requireStaff(staffID);
    const grades = ["G0", "G1", "G2", "G3", "G4"];
    const index = grades.indexOf(staff.grade);
    if (index < 0) throw new Error(`unknown grade: ${staff.grade}`);
    const nextIndex =
      direction === "up" ? Math.min(grades.length - 1, index + 1) : Math.max(0, index - 1);
    if (nextIndex === index) return staff;
    const timestamp = now();
    this.db
      .query("UPDATE staff SET grade = ?, updated_at = ? WHERE id = ?")
      .run(grades[nextIndex], timestamp, staffID);
    this.addEvent(null, null, "staff.grade_changed", {
      staffID,
      from: staff.grade,
      to: grades[nextIndex],
      direction,
    });
    return this.requireStaff(staffID);
  }

  countBlacklist(): number {
    const row = this.db
      .query("SELECT COUNT(*) AS count FROM blacklist WHERE expires_at > ?")
      .get(now()) as { count: number };
    return row.count;
  }

  countStaff(): number {
    const row = this.db.query("SELECT COUNT(*) AS count FROM staff WHERE status = 'active'").get() as {
      count: number;
    };
    return row.count;
  }

  countTasks(missionID?: string): number {
    const row = missionID
      ? (this.db
          .query("SELECT COUNT(*) AS count FROM tasks WHERE mission_id = ?")
          .get(missionID) as { count: number })
      : (this.db.query("SELECT COUNT(*) AS count FROM tasks").get() as { count: number });
    return row.count;
  }

  recordLedger(input: LedgerInput): void {
    const cost = input.cost ?? 0;
    const insert = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO ledger
           (mission_id, task_id, staff_id, session_id, provider, model, variant,
            input_tokens, output_tokens, cost, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.missionID ?? null,
          input.taskID ?? null,
          input.staffID ?? null,
          input.sessionID ?? null,
          input.provider ?? null,
          input.model ?? null,
          input.variant ?? null,
          input.inputTokens ?? 0,
          input.outputTokens ?? 0,
          cost,
          now(),
        );

      if (input.missionID) {
        this.db
          .query(
            `UPDATE missions
             SET actual_cost_usd = actual_cost_usd + ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(cost, now(), input.missionID);
      }
    });
    insert();
  }

  private budgetRadar(expected: number | null, actual: number) {
    if (expected === null || expected <= 0) {
      return { ratio: null, warnings: [] as string[], anomaly: false };
    }
    const ratio = actual / expected;
    const warnings: string[] = [];
    if (ratio >= 0.7) warnings.push("70% of expected");
    if (ratio >= 0.9) warnings.push("90% of expected");
    if (ratio > 3) warnings.push("more than 3x expected");
    return { ratio, warnings, anomaly: ratio > 3 };
  }

  budgetSummary(missionID?: string) {
    if (missionID) {
      const mission = this.requireMission(missionID);
      const row = this.db
        .query(
          `SELECT COUNT(*) AS entries, COALESCE(SUM(cost), 0) AS total
           FROM ledger WHERE mission_id = ?`,
        )
        .get(missionID) as { entries: number; total: number };
      return {
        scope: missionID,
        mission_id: missionID,
        expectedCostUsd: mission.expectedCostUsd,
        actualCostUsd: row.total,
        entries: row.entries,
        ...this.budgetRadar(mission.expectedCostUsd, row.total),
        mission,
      };
    }

    const totals = this.db
      .query(
        `SELECT COUNT(*) AS entries, COALESCE(SUM(cost), 0) AS total
         FROM ledger`,
      )
      .get() as { entries: number; total: number };
    const expected = this.db
      .query("SELECT COALESCE(SUM(expected_cost_usd), 0) AS total FROM missions")
      .get() as { total: number };
    const missions = this.listMissions(100);

    return {
      scope: "global",
      expectedCostUsd: expected.total,
      actualCostUsd: totals.total,
      entries: totals.entries,
      ...this.budgetRadar(expected.total, totals.total),
      byMission: missions.map((mission) => ({
        id: mission.id,
        title: mission.title,
        status: mission.status,
        expectedCostUsd: mission.expectedCostUsd,
        actualCostUsd: mission.actualCostUsd,
        ...this.budgetRadar(mission.expectedCostUsd, mission.actualCostUsd),
      })),
    };
  }

  openDispute(
    missionID: string,
    taskID: string,
    claim: string,
    evidence?: unknown,
  ): Dispute {
    this.requireMission(missionID);
    const task = this.requireTask(missionID, taskID);
    if (!["returned", "in_review", "integrated"].includes(task.status)) {
      throw new Error(`cannot open dispute in task status ${task.status}`);
    }
    if (!claim.trim()) throw new Error("dispute claim is required");
    const existing = this.db
      .query(
        `SELECT * FROM disputes
         WHERE mission_id = ? AND task_id = ? AND status = 'open'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(missionID, taskID) as DisputeRow | undefined;
    if (existing) return mapDispute(existing);

    const id = `d_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const timestamp = now();
    const create = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO disputes
           (id, mission_id, task_id, status, round, claim, evidence_json, created_at, updated_at)
           VALUES (?, ?, ?, 'open', 0, ?, ?, ?, ?)`,
        )
        .run(
          id,
          missionID,
          taskID,
          claim.trim(),
          evidence === undefined ? null : JSON.stringify(evidence),
          timestamp,
          timestamp,
        );
      this.addEvent(missionID, taskID, "dispute.opened", { disputeID: id, claim: claim.trim() });
    });
    create();
    return this.requireDispute(id);
  }

  getDispute(id: string): Dispute | undefined {
    const row = this.db.query("SELECT * FROM disputes WHERE id = ?").get(id) as
      | DisputeRow
      | undefined;
    return row ? mapDispute(row) : undefined;
  }

  requireDispute(id: string): Dispute {
    const dispute = this.getDispute(id);
    if (!dispute) throw new Error(`dispute not found: ${id}`);
    return dispute;
  }

  listDisputes(missionID: string): Dispute[] {
    const rows = this.db
      .query("SELECT * FROM disputes WHERE mission_id = ? ORDER BY created_at DESC")
      .all(missionID) as DisputeRow[];
    return rows.map(mapDispute);
  }

  listDisputeMessages(disputeID: string): DisputeMessage[] {
    const rows = this.db
      .query("SELECT * FROM dispute_messages WHERE dispute_id = ? ORDER BY id ASC")
      .all(disputeID) as DisputeMessageRow[];
    return rows.map(mapDisputeMessage);
  }

  replyDispute(disputeID: string, role: string, text: string, evidence?: unknown): Dispute {
    const dispute = this.requireDispute(disputeID);
    if (dispute.status !== "open") throw new Error(`dispute is not open: ${dispute.status}`);
    if (dispute.round >= 2) {
      throw new Error("dispute round limit reached (2); use action=rule");
    }
    if (!text.trim()) throw new Error("dispute reply text is required");
    const timestamp = now();
    const reply = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO dispute_messages (dispute_id, role, text, evidence_json, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          disputeID,
          role,
          text.trim(),
          evidence === undefined ? null : JSON.stringify(evidence),
          timestamp,
        );
      this.db
        .query("UPDATE disputes SET round = round + 1, updated_at = ? WHERE id = ?")
        .run(timestamp, disputeID);
      this.addEvent(
        dispute.missionID,
        dispute.taskID,
        "dispute.reply",
        { disputeID, role, round: dispute.round + 1 },
      );
    });
    reply();
    return this.requireDispute(disputeID);
  }

  saveRuling(disputeID: string, ruling: unknown): Dispute {
    const dispute = this.requireDispute(disputeID);
    if (dispute.status !== "open") throw new Error(`dispute is not open: ${dispute.status}`);
    const winner = (ruling as { winner?: string } | null)?.winner;
    if (!winner || !["worker", "reviewer", "split"].includes(winner)) {
      throw new Error("ruling.winner must be worker, reviewer or split");
    }
    const task = this.requireTask(dispute.missionID, dispute.taskID);
    const timestamp = now();

    const resolve = this.db.transaction(() => {
      this.db
        .query(
          `UPDATE disputes SET status = 'resolved', ruling_json = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(JSON.stringify(ruling), timestamp, disputeID);

      if (winner === "worker") {
        this.db
          .query(
            `UPDATE tasks SET status = 'submitted', updated_at = ?
             WHERE mission_id = ? AND id = ?`,
          )
          .run(timestamp, dispute.missionID, dispute.taskID);
        this.db
          .query(
            `UPDATE missions SET status = 'reviewing', updated_at = ?
             WHERE id = ?`,
          )
          .run(timestamp, dispute.missionID);
        this.penalize(task.reviewerStaffID, -0.2, `lost arbitration ${disputeID}`);
      } else {
        this.db
          .query(
            `UPDATE tasks SET status = 'returned', updated_at = ?
             WHERE mission_id = ? AND id = ?`,
          )
          .run(timestamp, dispute.missionID, dispute.taskID);
        this.db
          .query(
            `UPDATE missions SET status = 'executing', updated_at = ?
             WHERE id = ?`,
          )
          .run(timestamp, dispute.missionID);
        if (winner === "reviewer") {
          this.penalize(task.staffID, -0.1, `lost arbitration ${disputeID}`);
        }
      }

      this.addLesson(
        dispute.missionID,
        dispute.taskID,
        `Arbitration ${disputeID}: ${String((ruling as { reasoning?: string }).reasoning ?? "")}`,
        ["arbitration", winner],
      );
      this.addEvent(dispute.missionID, dispute.taskID, "dispute.resolved", {
        disputeID,
        winner,
      });
    });
    resolve();
    return this.requireDispute(disputeID);
  }

  addLesson(missionID: string | null, taskID: string | null, text: string, tags: string[] = []): void {
    if (!text.trim()) return;
    this.db
      .query(
        `INSERT INTO lessons (mission_id, task_id, text, tags_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(missionID, taskID, text.trim(), JSON.stringify(tags), now());
  }

  listLessons(missionID?: string): Lesson[] {
    const rows = missionID
      ? (this.db
          .query("SELECT * FROM lessons WHERE mission_id = ? ORDER BY id DESC")
          .all(missionID) as LessonRow[])
      : (this.db.query("SELECT * FROM lessons ORDER BY id DESC").all() as LessonRow[]);
    return rows.map(mapLesson);
  }

  recordAudit(input: {
    missionID: string;
    taskID: string;
    kind: string;
    status: "pass" | "fail";
    reviewerStaffID?: string | null;
    reviewerSessionID?: string | null;
    verdict?: unknown;
    notes?: string;
  }): Audit {
    const isTaskAudit = input.kind === "second_review";
    const task = isTaskAudit ? this.requireTask(input.missionID, input.taskID) : undefined;
    const id = `a_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const timestamp = now();
    const record = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO audits
           (id, mission_id, task_id, kind, status, reviewer_staff_id, reviewer_session_id, verdict_json, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.missionID,
          input.taskID,
          input.kind,
          input.status,
          input.reviewerStaffID ?? null,
          input.reviewerSessionID ?? null,
          input.verdict === undefined ? null : JSON.stringify(input.verdict),
          input.notes ?? null,
          timestamp,
        );

      if (input.status === "fail") {
        if (isTaskAudit && task) {
          this.db
            .query(
              `UPDATE tasks SET status = 'returned', updated_at = ?
               WHERE mission_id = ? AND id = ?`,
            )
            .run(timestamp, input.missionID, input.taskID);
          this.db
            .query(
              `UPDATE missions SET status = 'executing', updated_at = ?
               WHERE id = ?`,
            )
            .run(timestamp, input.missionID);
          this.penalize(task.reviewerStaffID, -0.3, `false pass audit ${id}`);
          this.addLesson(
            input.missionID,
            input.taskID,
            `False pass audit ${id}: ${input.notes ?? "second review failed"}`,
            ["audit", "false_pass"],
          );
          this.addEvent(input.missionID, input.taskID, "audit.false_pass", { auditID: id });
        } else {
          this.addLesson(
            input.missionID,
            input.taskID === "mission" ? null : input.taskID,
            `Process audit ${id}: ${input.notes ?? "process failed"}`,
            ["audit", "process"],
          );
          this.addEvent(input.missionID, null, "audit.process_failed", { auditID: id });
        }
      } else {
        this.addEvent(
          input.missionID,
          isTaskAudit ? input.taskID : null,
          isTaskAudit ? "audit.passed" : "audit.process_passed",
          { auditID: id },
        );
      }
    });
    record();
    return this.requireAudit(id);
  }

  getAudit(id: string): Audit | undefined {
    const row = this.db.query("SELECT * FROM audits WHERE id = ?").get(id) as AuditRow | undefined;
    return row ? mapAudit(row) : undefined;
  }

  requireAudit(id: string): Audit {
    const audit = this.getAudit(id);
    if (!audit) throw new Error(`audit not found: ${id}`);
    return audit;
  }

  listAudits(missionID: string): Audit[] {
    const rows = this.db
      .query("SELECT * FROM audits WHERE mission_id = ? ORDER BY created_at DESC")
      .all(missionID) as AuditRow[];
    return rows.map(mapAudit);
  }

  hasAudit(missionID: string, taskID: string): boolean {
    const row = this.db
      .query("SELECT COUNT(*) AS count FROM audits WHERE mission_id = ? AND task_id = ?")
      .get(missionID, taskID) as { count: number };
    return row.count > 0;
  }

  private penalize(staffID: string | null, delta: number, note: string): void {
    if (!staffID) return;
    const staff = this.getStaff(staffID);
    if (!staff || staff.status !== "active") return;
    const nextScore = Math.max(0, Math.min(1, staff.score + delta));
    const timestamp = now();
    this.db
      .query("UPDATE staff SET score = ?, updated_at = ? WHERE id = ?")
      .run(nextScore, timestamp, staffID);
    this.db
      .query(
        `INSERT INTO appraisals (staff_id, delta, note, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(staffID, delta, note, timestamp);
  }

  tuiState(missionID?: string) {
    const missions = this.listMissions(20);
    const mission = missionID ? this.requireMission(missionID) : missions[0];
    const tasks = mission ? this.listTasks(mission.id) : [];
    return {
      generatedAt: now(),
      missions,
      mission: mission ?? null,
      plan: mission ? this.getPlan(mission.id) : null,
      tasks: tasks.map(({ brief, rawReport, ...task }) => task),
      staff: this.listStaff(50),
      budget: mission ? this.budgetSummary(mission.id) : this.budgetSummary(),
      audits: mission ? this.listAudits(mission.id) : [],
      disputes: mission ? this.listDisputes(mission.id) : [],
      lessons: mission ? this.listLessons(mission.id) : [],
    };
  }

  countMissions(): number {
    const row = this.db.query("SELECT COUNT(*) AS count FROM missions").get() as {
      count: number;
    };
    return row.count;
  }

  countDisputes(): number {
    const row = this.db.query("SELECT COUNT(*) AS count FROM disputes").get() as {
      count: number;
    };
    return row.count;
  }

  countAudits(): number {
    const row = this.db.query("SELECT COUNT(*) AS count FROM audits").get() as {
      count: number;
    };
    return row.count;
  }

  countLessons(): number {
    const row = this.db.query("SELECT COUNT(*) AS count FROM lessons").get() as {
      count: number;
    };
    return row.count;
  }

  addEvent(
    missionIDValue: string | null,
    taskID: string | null,
    type: string,
    payload: unknown,
  ): void {
    this.db
      .query(
        `INSERT INTO events (mission_id, task_id, type, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        missionIDValue,
        taskID,
        type,
        payload === undefined ? null : JSON.stringify(payload),
        now(),
      );
  }
}
