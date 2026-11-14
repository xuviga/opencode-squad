import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { mapStaff, now, type Staff, type StaffRow, type TaskRow } from "../model";
import type { SquadStore } from "../store";

export class StaffRepository {
  constructor(
    private readonly db: Database,
    private readonly store: SquadStore,
  ) {}

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
      this.store.addEvent(null, null, "staff.hired", {
        staffID: id,
        persona: input.persona,
        grade: input.grade,
        agent: input.agent,
        sessionID: input.sessionID,
      });
    });
    hire();
    return this.store.requireStaff(id);
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

  listStaffWithWorktrees(): Staff[] {
    const rows = this.db
      .query(
        "SELECT * FROM staff WHERE worktree_directory IS NOT NULL AND worktree_directory != ''",
      )
      .all() as StaffRow[];
    return rows.map(mapStaff);
  }

  /** Forgets a removed worktree so finalize/GC do not treat it as live isolation. */
  clearWorktree(staffID: string): Staff {
    this.db
      .query("UPDATE staff SET worktree_directory = NULL, updated_at = ? WHERE id = ?")
      .run(now(), staffID);
    return this.store.requireStaff(staffID);
  }

  appraiseStaff(staffID: string, delta: number, note = ""): Staff {
    const staff = this.store.requireStaff(staffID);
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
      this.store.addEvent(null, null, "staff.appraised", { staffID, delta, note });
    });
    appraise();
    return this.store.requireStaff(staffID);
  }

  fireStaff(staffID: string, reason: string, evidenceRef: string): Staff {
    const staff = this.store.requireStaff(staffID);
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
      this.store.addEvent(null, null, "staff.fired", {
        staffID,
        persona: staff.persona,
        grade: staff.grade,
        reason: reason.trim(),
        evidenceRef: evidenceRef.trim(),
        blacklistedUntil: expiresAt,
      });
    });
    fire();
    return this.store.requireStaff(staffID);
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
    const staff = this.store.requireStaff(staffID);
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
    const staff = this.store.requireStaff(staffID);
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
    this.store.addEvent(null, null, "staff.grade_changed", {
      staffID,
      from: staff.grade,
      to: grades[nextIndex],
      direction,
    });
    return this.store.requireStaff(staffID);
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

  penalize(staffID: string | null, delta: number, note: string): void {
    if (!staffID) return;
    const staff = this.getStaff(staffID);
    if (staff?.status !== "active") return;
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
}
