import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import {
  mapDispute,
  mapDisputeMessage,
  mapLesson,
  now,
  type Dispute,
  type DisputeMessage,
  type DisputeMessageRow,
  type DisputeRow,
  type Lesson,
  type LessonRow,
} from "../model";
import type { SquadStore } from "../store";

export class DisputeRepository {
  constructor(
    private readonly db: Database,
    private readonly store: SquadStore,
  ) {}

  openDispute(
    missionID: string,
    taskID: string,
    claim: string,
    evidence?: unknown,
  ): Dispute {
    this.store.requireMission(missionID);
    const task = this.store.requireTask(missionID, taskID);
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
      this.store.addEvent(missionID, taskID, "dispute.opened", {
        disputeID: id,
        claim: claim.trim(),
      });
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
      this.store.addEvent(dispute.missionID, dispute.taskID, "dispute.reply", {
        disputeID,
        role,
        round: dispute.round + 1,
      });
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
    const task = this.store.requireTask(dispute.missionID, dispute.taskID);
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
        this.store.staff.penalize(task.reviewerStaffID, -0.2, `lost arbitration ${disputeID}`);
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
          this.store.staff.penalize(task.staffID, -0.1, `lost arbitration ${disputeID}`);
        }
      }

      this.addLesson(
        dispute.missionID,
        dispute.taskID,
        `Arbitration ${disputeID}: ${String((ruling as { reasoning?: string }).reasoning ?? "")}`,
        ["arbitration", winner],
      );
      this.store.addEvent(dispute.missionID, dispute.taskID, "dispute.resolved", {
        disputeID,
        winner,
      });
    });
    resolve();
    return this.requireDispute(disputeID);
  }

  addLesson(
    missionID: string | null,
    taskID: string | null,
    text: string,
    tags: string[] = [],
  ): void {
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

  countDisputes(): number {
    const row = this.db.query("SELECT COUNT(*) AS count FROM disputes").get() as {
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
}
