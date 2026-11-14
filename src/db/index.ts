import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { MIGRATIONS } from "./schema";

export function openSquadDb(directory: string): Database {
  const dataDir = join(directory, ".squad");
  mkdirSync(dataDir, { recursive: true });

  const db = new Database(join(dataDir, "squad.db"), { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  for (const migration of MIGRATIONS) {
    const applied = db
      .query("SELECT version FROM schema_migrations WHERE version = ?")
      .get(migration.version);
    if (applied) continue;

    const apply = db.transaction(() => {
      db.exec(migration.sql);
      db.query(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      ).run(migration.version, migration.name, new Date().toISOString());
    });
    apply();
  }

  return db;
}
