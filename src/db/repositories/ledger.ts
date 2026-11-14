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
    const ratio = actual / expected;
    const warnings: string[] = [];
    if (ratio >= 0.7) warnings.push("70% of expected");
    if (ratio >= 0.9) warnings.push("90% of expected");
    if (ratio > 3) warnings.push("more than 3x expected");
    return { ratio, warnings, anomaly: ratio > 3 };
  }

  budgetSummary(missionID?: string) {
    if (missionID) {
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
}
