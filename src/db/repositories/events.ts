import type { Database } from "bun:sqlite";
import { now } from "../model";

export class EventRepository {
  constructor(private readonly db: Database) {}

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
}
