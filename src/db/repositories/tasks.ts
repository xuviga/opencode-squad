import type { Database } from "bun:sqlite";
import { mapTask, now, type Task, type TaskRow } from "../model";
import type { SquadStore } from "../store";

export class TaskRepository {
  constructor(
    private readonly db: Database,
    private readonly store: SquadStore,
  ) {}

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

  listTasksByStaff(staffID: string): Task[] {
    const rows = this.db
      .query("SELECT * FROM tasks WHERE staff_id = ? ORDER BY created_at ASC")
      .all(staffID) as TaskRow[];
    return rows.map(mapTask);
  }

  assignTask(missionID: string, taskID: string, staffID: string, brief: unknown): Task {
    const mission = this.store.requireMission(missionID);
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
    const staff = this.store.requireStaff(staffID);
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
      this.store.addEvent(missionID, taskID, "task.escalated", {
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
      this.store.addEvent(missionID, taskID, "task.assigned", {
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
    this.store.addEvent(missionID, taskID, "task.running", {});
    return this.requireTask(missionID, taskID);
  }

  saveRawReport(missionID: string, taskID: string, rawReport: string): Task {    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks SET raw_report = ?, status = 'submitted', report_captured_at = ?, updated_at = ?
         WHERE mission_id = ? AND id = ?`,
      )
      .run(rawReport, timestamp, timestamp, missionID, taskID);
    this.store.addEvent(missionID, taskID, "report.captured", {
      chars: rawReport.length,
    });
    this.store.missions.maybeAdvanceMission(missionID);
    return this.requireTask(missionID, taskID);
  }

  /** Records the filesystem baseline used for in-place (no-git) reviews. */
  setTaskSnapshot(missionID: string, taskID: string, directory: string): Task {
    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks SET snapshot_directory = ?, updated_at = ?
         WHERE mission_id = ? AND id = ?`,
      )
      .run(directory, timestamp, missionID, taskID);
    this.store.addEvent(missionID, taskID, "snapshot.captured", { directory });
    return this.requireTask(missionID, taskID);
  }

  completeTask(missionID: string, taskID: string, report: unknown): Task {    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks SET status = 'submitted', report_json = ?, updated_at = ?
         WHERE mission_id = ? AND id = ?`,
      )
      .run(JSON.stringify(report), timestamp, missionID, taskID);
    this.store.addEvent(missionID, taskID, "report.validated", {});
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
      this.store.addEvent(missionID, taskID, "review.started", {
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
    this.store.addEvent(missionID, taskID, "review.reset", { reason });
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
        .run(
          outcome === "pass" ? "integrated" : "returned",
          JSON.stringify(verdict),
          timestamp,
          missionID,
          taskID,
        );

      if (outcome === "fail") {
        this.db
          .query(
            `UPDATE missions SET status = 'executing', updated_at = ?
             WHERE id = ? AND status = 'reviewing'`,
          )
          .run(timestamp, missionID);
        this.store.addEvent(missionID, taskID, "review.failed", {
          round: task.reviewRound,
        });
      } else {
        this.store.addEvent(missionID, taskID, "review.passed", {
          round: task.reviewRound,
        });
      }
    });
    save();
    this.store.missions.advanceDependents(missionID);
    this.store.missions.maybeFinishMission(missionID);
    return this.requireTask(missionID, taskID);
  }

  /** In-place isolation: the work already lives in the project directory. */
  markMergedInPlace(missionID: string, taskID: string): Task {
    const task = this.requireTask(missionID, taskID);
    if (task.status !== "integrated") {
      throw new Error(`cannot merge task in status ${task.status}`);
    }
    if (task.mergedAt) return task;
    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks SET merged_at = ?, integration_commit = NULL, updated_at = ?
         WHERE mission_id = ? AND id = ?`,
      )
      .run(timestamp, timestamp, missionID, taskID);
    this.store.addEvent(missionID, taskID, "integration.in_place", {});
    return this.requireTask(missionID, taskID);
  }

  markMerged(missionID: string, taskID: string, commit: string, sourceCommit?: string): Task {    const task = this.requireTask(missionID, taskID);
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
    this.store.addEvent(missionID, taskID, "integration.merged", {
      commit: commit.trim(),
      sourceCommit: sourceCommit?.trim() || null,
    });
    return this.requireTask(missionID, taskID);
  }

  failTask(missionID: string, taskID: string, reason: string): Task {
    const timestamp = now();
    this.db
      .query(
        `UPDATE tasks SET status = 'failed', updated_at = ?
         WHERE mission_id = ? AND id = ?`,
      )
      .run(timestamp, missionID, taskID);
    this.store.addEvent(missionID, taskID, "task.failed", { reason });
    return this.requireTask(missionID, taskID);
  }

  countTasks(missionID?: string): number {
    const row = missionID
      ? (this.db
          .query("SELECT COUNT(*) AS count FROM tasks WHERE mission_id = ?")
          .get(missionID) as { count: number })
      : (this.db.query("SELECT COUNT(*) AS count FROM tasks").get() as { count: number });
    return row.count;
  }
}
