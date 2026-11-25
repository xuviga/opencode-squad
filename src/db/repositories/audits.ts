import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mapAudit, now, type Audit, type AuditRow } from "../model";
import type { SquadStore } from "../store";

export class AuditRepository {
  constructor(
    private readonly db: Database,
    private readonly store: SquadStore,
  ) {}

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
    const task = isTaskAudit ? this.store.requireTask(input.missionID, input.taskID) : undefined;
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
          const dependents = this.store.listDependents(input.missionID, input.taskID);
          const shipped = dependents.filter(
            (dependent) => dependent.status === "integrated" || dependent.mergedAt,
          );
          if (shipped.length > 0) {
            // Reopening would invalidate work that already landed downstream.
            // Fail the mission instead of silently corrupting a shipped chain.
            this.db
              .query(
                `UPDATE missions SET status = 'failed', updated_at = ?
                 WHERE id = ? AND status NOT IN ('done', 'failed', 'aborted')`,
              )
              .run(timestamp, input.missionID);
            this.store.staff.penalize(
              task.reviewerStaffID,
              -0.3,
              `late false pass audit ${id}`,
            );
            this.store.addLesson(
              input.missionID,
              input.taskID,
              `Late false pass audit ${id}: ${input.notes ?? "second review failed"}. ` +
                `Dependents already integrated (${shipped.map((row) => row.id).join(", ")}); ` +
                `the task is left integrated and the mission is failed for manual review.`,
              ["audit", "false_pass", "late"],
            );
            this.store.addEvent(input.missionID, input.taskID, "audit.late_false_pass", {
              auditID: id,
              dependents: shipped.map((row) => row.id),
            });
          } else {
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
            this.store.staff.penalize(task.reviewerStaffID, -0.3, `false pass audit ${id}`);
            this.store.addLesson(
              input.missionID,
              input.taskID,
              `False pass audit ${id}: ${input.notes ?? "second review failed"}`,
              ["audit", "false_pass"],
            );
            this.store.addEvent(input.missionID, input.taskID, "audit.false_pass", { auditID: id });
          }
        } else {
          this.store.addLesson(
            input.missionID,
            input.taskID === "mission" ? null : input.taskID,
            `Process audit ${id}: ${input.notes ?? "process failed"}`,
            ["audit", "process"],
          );
          this.store.addEvent(input.missionID, null, "audit.process_failed", { auditID: id });
        }
      } else {
        this.store.addEvent(
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
      .query(
        "SELECT COUNT(*) AS count FROM audits WHERE mission_id = ? AND task_id = ? AND kind = 'second_review'",
      )
      .get(missionID, taskID) as { count: number };
    return row.count > 0;
  }

  countAudits(): number {
    const row = this.db.query("SELECT COUNT(*) AS count FROM audits").get() as {
      count: number;
    };
    return row.count;
  }
}
