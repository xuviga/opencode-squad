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
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      );
      for (const task of plan.tasks) {
        insertTask.run(
          id,
          task.id,
          task.title,
          task.class,
          task.role,
          task.grade,
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
      byMission: missions.map((mission) => ({
        id: mission.id,
        title: mission.title,
        status: mission.status,
        expectedCostUsd: mission.expectedCostUsd,
        actualCostUsd: mission.actualCostUsd,
      })),
    };
  }

  countMissions(): number {
    const row = this.db.query("SELECT COUNT(*) AS count FROM missions").get() as {
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
