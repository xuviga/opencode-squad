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
  {
    version: 3,
    name: "reviews",
    sql: `
ALTER TABLE tasks ADD COLUMN reviewer_staff_id TEXT;
ALTER TABLE tasks ADD COLUMN reviewer_session_id TEXT;
ALTER TABLE tasks ADD COLUMN review_round INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tasks_reviewer ON tasks(reviewer_staff_id);
CREATE INDEX IF NOT EXISTS idx_tasks_review_session ON tasks(reviewer_session_id);
`,
  },
  {
    version: 4,
    name: "hr",
    sql: `
ALTER TABLE staff ADD COLUMN fired_at TEXT;
ALTER TABLE staff ADD COLUMN evidence_ref TEXT;
CREATE TABLE IF NOT EXISTS appraisals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id TEXT NOT NULL,
  delta REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona TEXT NOT NULL,
  grade TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appraisals_staff ON appraisals(staff_id, created_at);
CREATE INDEX IF NOT EXISTS idx_blacklist_persona_grade ON blacklist(persona, grade, expires_at);
`,
  },
  {
    version: 5,
    name: "worktrees",
    sql: `
ALTER TABLE staff ADD COLUMN worktree_directory TEXT;
CREATE INDEX IF NOT EXISTS idx_staff_worktree ON staff(worktree_directory);
`,
  },
  {
    version: 6,
    name: "disputes_audits",
    sql: `
CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  round INTEGER NOT NULL DEFAULT 0,
  claim TEXT NOT NULL,
  evidence_json TEXT,
  ruling_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dispute_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispute_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  evidence_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (dispute_id) REFERENCES disputes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  reviewer_staff_id TEXT,
  reviewer_session_id TEXT,
  verdict_json TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id TEXT,
  task_id TEXT,
  text TEXT NOT NULL,
  tags_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_disputes_mission_task ON disputes(mission_id, task_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON dispute_messages(dispute_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audits_mission_task ON audits(mission_id, task_id);
CREATE INDEX IF NOT EXISTS idx_lessons_mission ON lessons(mission_id, created_at);
`,
  },
  {
    version: 7,
    name: "integration_gate",
    sql: `
ALTER TABLE tasks ADD COLUMN report_captured_at TEXT;
ALTER TABLE tasks ADD COLUMN merged_at TEXT;
ALTER TABLE tasks ADD COLUMN integration_commit TEXT;
UPDATE tasks SET report_captured_at = updated_at WHERE raw_report IS NOT NULL AND report_captured_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_merged ON tasks(mission_id, merged_at);
`,
  },
  {
    version: 8,
    name: "task_capabilities",
    sql: `
ALTER TABLE tasks ADD COLUMN capabilities_json TEXT;
UPDATE tasks SET capabilities_json = '[]' WHERE capabilities_json IS NULL;
`,
  },
  {
    version: 9,
    name: "isolation_and_snapshots",
    sql: `
ALTER TABLE missions ADD COLUMN isolation TEXT NOT NULL DEFAULT 'worktree';
ALTER TABLE tasks ADD COLUMN snapshot_directory TEXT;
`,
  },
  {
    version: 10,
    name: "worktree_base",
    sql: `
ALTER TABLE staff ADD COLUMN worktree_base TEXT;
`,
  },
  {
    version: 11,
    name: "task_paths",
    sql: `
ALTER TABLE tasks ADD COLUMN paths_json TEXT;
UPDATE tasks SET paths_json = '[]' WHERE paths_json IS NULL;
`,
  },
];
