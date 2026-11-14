export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "init",
    sql: `
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  plan_json TEXT,
  plan_version INTEGER NOT NULL DEFAULT 0,
  expected_cost_usd REAL,
  actual_cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  mission_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  class TEXT NOT NULL,
  role TEXT NOT NULL,
  grade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  acceptance_json TEXT NOT NULL DEFAULT '[]',
  depends_on_json TEXT NOT NULL DEFAULT '[]',
  brief_json TEXT,
  report_json TEXT,
  verdict_json TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (mission_id, id),
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  persona TEXT NOT NULL,
  grade TEXT NOT NULL,
  session_id TEXT,
  score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id TEXT,
  task_id TEXT,
  type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id TEXT,
  task_id TEXT,
  staff_id TEXT,
  session_id TEXT,
  provider TEXT,
  model TEXT,
  variant TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_mission_status ON tasks(mission_id, status);
CREATE INDEX IF NOT EXISTS idx_events_mission_created ON events(mission_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_mission_created ON ledger(mission_id, created_at);
CREATE INDEX IF NOT EXISTS idx_missions_status_updated ON missions(status, updated_at);
`,
  },
  {
    version: 2,
    name: "assignments",
    sql: `
ALTER TABLE tasks ADD COLUMN staff_id TEXT;
ALTER TABLE tasks ADD COLUMN session_id TEXT;
ALTER TABLE tasks ADD COLUMN assigned_at TEXT;
ALTER TABLE tasks ADD COLUMN raw_report TEXT;
ALTER TABLE tasks ADD COLUMN ledger_recorded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE staff ADD COLUMN agent TEXT;
ALTER TABLE staff ADD COLUMN provider TEXT;
ALTER TABLE staff ADD COLUMN model TEXT;
ALTER TABLE staff ADD COLUMN variant TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_staff ON tasks(staff_id);
CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
`,
  },
];
