import type { Database } from "bun:sqlite";
import { now, type LedgerInput } from "../model";
import type { SquadStore } from "../store";

export class LedgerRepository {
  constructor(
    private readonly db: Database,
    private readonly store: SquadStore,
  ) {}

  hasLedgerEntry(missionID: string, taskID: string, sessionID: string): boolean {
    const row = this.db
      .query(
        `SELECT COUNT(*) AS count FROM ledger
         WHERE mission_id = ? AND task_id = ? AND session_id = ?`,
      )
      .get(missionID, taskID, sessionID) as { count: number };
    return row.count > 0;
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
    const [soft, hard] = this.store.config.softWarnPct;
    const softRatio = soft / 100;
    const hardRatio = hard / 100;
    const ratio = actual / expected;
    const warnings: string[] = [];
    if (ratio >= softRatio) warnings.push(`${soft}% of expected`);
    if (ratio >= hardRatio) warnings.push(`${hard}% of expected`);
    if (ratio > 3) warnings.push("more than 3x expected");
    return { ratio, warnings, anomaly: ratio > 3 };
  }

  budgetSummary(missionID?: string) {    if (missionID) {
      const mission = this.store.requireMission(missionID);
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
    const missions = this.store.listMissions(100);

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

  /**
   * Delivery metrics that mean something: first-pass rate, rework, failure
   * rate and cost per integrated task. Computed from task rows and the ledger,
   * so every number can be reproduced from the database.
   */
  metrics(missionID?: string) {
    const missions = missionID
      ? [this.store.requireMission(missionID)]
      : this.store.listMissions(100);

    const scopedTasks = missions.flatMap((mission) => this.store.listTasks(mission.id));
    const integrated = scopedTasks.filter((task) => task.status === "integrated");
    const failed = scopedTasks.filter(
      (task) => task.status === "failed" || task.status === "escalated",
    );
    const retried = scopedTasks.filter(
      (task) => task.attempts > 0 || task.status === "returned",
    );
    const attemptsTotal = scopedTasks.reduce((sum, task) => sum + task.attempts, 0);

    const costRow = missionID
      ? (this.db
          .query("SELECT COALESCE(SUM(cost), 0) AS total FROM ledger WHERE mission_id = ?")
          .get(missionID) as { total: number })
      : (this.db.query("SELECT COALESCE(SUM(cost), 0) AS total FROM ledger").get() as {
          total: number;
        });

    const auditRows = this.db
      .query(
        missionID
          ? "SELECT status, COUNT(*) AS count FROM audits WHERE mission_id = ? GROUP BY status"
          : "SELECT status, COUNT(*) AS count FROM audits GROUP BY status",
      )
      .all(...(missionID ? [missionID] : [])) as Array<{ status: string; count: number }>;
    const auditsPass = auditRows.find((row) => row.status === "pass")?.count ?? 0;
    const auditsFail = auditRows.find((row) => row.status === "fail")?.count ?? 0;

    const disputeRow = this.db
      .query(
        missionID
          ? "SELECT COUNT(*) AS count FROM disputes WHERE mission_id = ?"
          : "SELECT COUNT(*) AS count FROM disputes",
      )
      .get(...(missionID ? [missionID] : [])) as { count: number };

    const firstPass = integrated.filter((task) => task.attempts === 0).length;
    const durationMinutes = missionID
      ? Math.max(
          0,
          Math.round(
            (Date.parse(this.store.requireMission(missionID).updatedAt) -
              Date.parse(this.store.requireMission(missionID).createdAt)) /
              60_000,
          ),
        )
      : null;

    return {
      scope: missionID ?? "global",
      missions: missions.length,
      tasks: {
        total: scopedTasks.length,
        integrated: integrated.length,
        failed: failed.length,
        returned: scopedTasks.filter((task) => task.status === "returned").length,
      },
      passAt1: integrated.length > 0 ? firstPass / integrated.length : null,
      reworkRate: scopedTasks.length > 0 ? retried.length / scopedTasks.length : null,
      averageAttempts: scopedTasks.length > 0 ? attemptsTotal / scopedTasks.length : null,
      costUsd: costRow.total,
      costPerIntegratedTaskUsd: integrated.length > 0 ? costRow.total / integrated.length : null,
      disputes: disputeRow.count,
      audits: { pass: auditsPass, fail: auditsFail },
      durationMinutes,
    };
  }
}
