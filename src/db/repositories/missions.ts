import type { Database } from "bun:sqlite";
import type { MissionPlan } from "../../plan";
import {
  isTerminalMissionStatus,
  mapMission,
  missionID,
  now,
  type Mission,
  type MissionRow,
} from "../model";
import type { SquadStore } from "../store";

export class MissionRepository {
  constructor(
    private readonly db: Database,
    private readonly store: SquadStore,
  ) {}

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
      this.store.addEvent(id, null, "mission.created", { title: cleanTitle });
    });
    create();

    return this.store.requireMission(id);
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

  /** Missions that are not in a terminal status and have not been updated within the window. */
  listStaleMissions(idleMinutes = 120): Mission[] {
    const safeMinutes = Math.max(1, Math.trunc(idleMinutes));
    const cutoff = new Date(Date.now() - safeMinutes * 60_000).toISOString();
    const rows = this.db
      .query(
        `SELECT * FROM missions
         WHERE updated_at < ? AND status NOT IN ('done', 'failed', 'aborted')
         ORDER BY updated_at ASC`,
      )
      .all(cutoff) as MissionRow[];
    return rows.map(mapMission);
  }

  countStaleMissions(idleMinutes = 120): number {
    const safeMinutes = Math.max(1, Math.trunc(idleMinutes));
    const cutoff = new Date(Date.now() - safeMinutes * 60_000).toISOString();
    const row = this.db
      .query(
        `SELECT COUNT(*) AS count FROM missions
         WHERE updated_at < ? AND status NOT IN ('done', 'failed', 'aborted')`,
      )
      .get(cutoff) as { count: number };
    return row.count;
  }

  getPlan(id: string): MissionPlan | null {
    const row = this.db.query("SELECT plan_json FROM missions WHERE id = ?").get(id) as
      | { plan_json: string | null }
      | undefined;
    if (!row?.plan_json) return null;
    return JSON.parse(row.plan_json) as MissionPlan;
  }

  submitPlan(id: string, plan: MissionPlan): { mission: Mission; plan: MissionPlan; version: number } {
    const mission = this.store.requireMission(id);
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
         (mission_id, id, title, class, role, grade, status, acceptance_json, depends_on_json, capabilities_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          JSON.stringify(task.capabilities ?? []),
          timestamp,
          timestamp,
        );
      }

      this.store.addEvent(id, null, "plan.submitted", {
        version,
        tasks: plan.tasks.length,
        expectedCostUsd: plan.expectedCostUsd ?? null,
      });
    });
    submit();

    return { mission: this.store.requireMission(id), plan, version };
  }

  approvePlan(id: string, note = ""): Mission {
    const mission = this.store.requireMission(id);
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
      this.store.addEvent(id, null, "plan.approved", { note });
    });
    approve();
    return this.store.requireMission(id);
  }

  rejectPlan(id: string, note = ""): Mission {
    const mission = this.store.requireMission(id);
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
      this.store.addEvent(id, null, "plan.rejected", { note });
    });
    reject();
    return this.store.requireMission(id);
  }

  maybeAdvanceMission(missionIDValue: string): void {
    const mission = this.store.requireMission(missionIDValue);
    if (mission.status !== "executing") return;
    const tasks = this.store.listTasks(missionIDValue);
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
      .run(now(), missionIDValue);
    this.store.addEvent(missionIDValue, null, "mission.reviewing", {});
  }

  advanceDependents(missionIDValue: string): void {
    const tasks = this.store.listTasks(missionIDValue);
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
        .run(now(), missionIDValue, task.id);
      this.store.addEvent(missionIDValue, task.id, "task.ready", {});
      advanced = true;
    }
    if (advanced) {
      this.db
        .query(
          `UPDATE missions SET status = 'executing', updated_at = ?
           WHERE id = ? AND status = 'reviewing'`,
        )
        .run(now(), missionIDValue);
    }
  }

  maybeFinishMission(missionIDValue: string): void {
    const mission = this.store.requireMission(missionIDValue);
    if (mission.status !== "reviewing") return;
    const tasks = this.store.listTasks(missionIDValue);
    if (tasks.length === 0) return;
    if (!tasks.every((task) => task.status === "integrated")) return;
    this.db
      .query(
        `UPDATE missions SET status = 'integrating', updated_at = ?
         WHERE id = ? AND status = 'reviewing'`,
      )
      .run(now(), missionIDValue);
    this.store.addEvent(missionIDValue, null, "mission.integrating", {});
  }

  finalizeMission(missionIDValue: string): Mission {
    const mission = this.store.requireMission(missionIDValue);
    if (mission.status !== "integrating") {
      throw new Error(`cannot finalize mission in status ${mission.status}`);
    }
    const tasks = this.store.listTasks(missionIDValue);
    if (tasks.length === 0 || !tasks.every((task) => task.status === "integrated")) {
      throw new Error("cannot finalize: not all tasks are integrated");
    }

    const requiredAudits = Math.max(1, Math.ceil(tasks.length * 0.1));
    const auditRow = this.db
      .query(
        `SELECT COUNT(*) AS count FROM audits
         WHERE mission_id = ? AND kind = 'second_review'`,
      )
      .get(missionIDValue) as { count: number };
    if (auditRow.count < requiredAudits) {
      throw new Error(
        `cannot finalize: requires ${requiredAudits} second-review audit(s), found ${auditRow.count}; run squad_audit`,
      );
    }

    for (const task of tasks) {
      if (task.mergedAt) continue;
      const staff = task.staffID ? this.store.getStaff(task.staffID) : undefined;
      if (staff?.worktreeDirectory) {
        throw new Error(`cannot finalize: worktree of ${task.id} is not merged; run squad_integrate`);
      }
    }

    this.db
      .query(
        `UPDATE missions SET status = 'done', updated_at = ?
         WHERE id = ? AND status = 'integrating'`,
      )
      .run(now(), missionIDValue);
    this.store.addEvent(missionIDValue, null, "mission.done", {});
    return this.store.requireMission(missionIDValue);
  }

  abortMission(missionIDValue: string, reason: string): Mission {
    if (!reason.trim()) throw new Error("abort reason is required");
    const mission = this.store.requireMission(missionIDValue);
    if (isTerminalMissionStatus(mission.status)) {
      throw new Error(`cannot abort mission in status ${mission.status}`);
    }
    const timestamp = now();
    const abort = this.db.transaction(() => {
      this.db
        .query(`UPDATE missions SET status = 'aborted', updated_at = ? WHERE id = ?`)
        .run(timestamp, missionIDValue);
      this.db
        .query(
          `UPDATE tasks SET status = 'cancelled', updated_at = ?
           WHERE mission_id = ? AND status NOT IN ('integrated', 'cancelled')`,
        )
        .run(timestamp, missionIDValue);
      this.store.addEvent(missionIDValue, null, "mission.aborted", { reason: reason.trim() });
    });
    abort();
    return this.store.requireMission(missionIDValue);
  }

  countMissions(): number {
    const row = this.db.query("SELECT COUNT(*) AS count FROM missions").get() as {
      count: number;
    };
    return row.count;
  }
}
