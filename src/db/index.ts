import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
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

type SharedHandle = {
  db: Database;
  refs: number;
};

const sharedHandles = new Map<string, SharedHandle>();

/**
 * One database handle per project directory for the whole process.
 *
 * The host disposes and reloads plugins while tool calls may still be in
 * flight (for example after `session.move`). Closing the handle on dispose
 * made those calls fail with "Cannot use a closed database". A shared handle
 * means a reload reuses the same connection, and a released handle stays open
 * for the life of the process — SQLite closes it at exit.
 */
export function acquireSquadDb(directory: string): {
  db: Database;
  release: () => void;
} {
  const key = resolve(directory);
  const existing = sharedHandles.get(key);
  const entry = existing ?? { db: openSquadDb(directory), refs: 0 };
  entry.refs += 1;
  sharedHandles.set(key, entry);

  let released = false;
  return {
    db: entry.db,
    release: () => {
      if (released) return;
      released = true;
      entry.refs = Math.max(0, entry.refs - 1);
    },
  };
}

/** Test-only visibility into the refcount table. */
export function sharedHandleCount(): number {
  return sharedHandles.size;
}

/** Drops every shared handle. Tests use it; the plugin never does. */
export function closeSharedHandles(): void {
  for (const entry of sharedHandles.values()) {
    try {
      entry.db.close();
    } catch {
      // already closed
    }
  }
  sharedHandles.clear();
}
