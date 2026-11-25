import { randomUUID } from "node:crypto";

export const MISSION_STATUSES = [
  "draft",
  "planning",
  "plan_gate",
  "staffing",
  "executing",
  "reviewing",
  "integrating",
  "done",
  "failed",
  "aborted",
] as const;

export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const ISOLATION_MODES = ["worktree", "none"] as const;
export type Isolation = (typeof ISOLATION_MODES)[number];

export function normalizeIsolation(value: unknown): Isolation {
  return value === "none" ? "none" : "worktree";
}

export const TERMINAL_MISSION_STATUSES: readonly MissionStatus[] = ["done", "failed", "aborted"];

export function isTerminalMissionStatus(status: string): boolean {
  return (TERMINAL_MISSION_STATUSES as readonly string[]).includes(status);
}

export type Mission = {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  isolation: Isolation;
  planVersion: number;
  expectedCostUsd: number | null;
  actualCostUsd: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

export type Staff = {
  id: string;
  persona: string;
  grade: string;
  agent: string | null;
  provider: string | null;
  model: string | null;
  variant: string | null;
  sessionID: string | null;
  worktreeDirectory: string | null;
  /** Commit the worktree branched from; the diff baseline for the reviewer. */
  worktreeBase: string | null;
  score: number;
  status: string;
  reason: string | null;
  firedAt: string | null;
  evidenceRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  missionID: string;
  title: string;
  class: string;
  role: string;
  grade: string;
  status: string;
  acceptance: string[];
  dependsOn: string[];
  capabilities: string[];
  staffID: string | null;
  sessionID: string | null;
  assignedAt: string | null;
  reviewerStaffID: string | null;
  reviewerSessionID: string | null;
  reviewRound: number;
  brief: unknown;
  report: unknown;
  verdict: unknown;
  rawReport: string | null;
  reportCapturedAt: string | null;
  snapshotDirectory: string | null;
  mergedAt: string | null;
  integrationCommit: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export type Dispute = {
  id: string;
  missionID: string;
  taskID: string;
  status: string;
  round: number;
  claim: string;
  evidence: unknown;
  ruling: unknown;
  createdAt: string;
  updatedAt: string;
};

export type DisputeMessage = {
  id: number;
  disputeID: string;
  role: string;
  text: string;
  evidence: unknown;
  createdAt: string;
};

export type Audit = {
  id: string;
  missionID: string;
  taskID: string;
  kind: string;
  status: string;
  reviewerStaffID: string | null;
  reviewerSessionID: string | null;
  verdict: unknown;
  notes: string | null;
  createdAt: string;
};

export type Lesson = {
  id: number;
  missionID: string | null;
  taskID: string | null;
  text: string;
  tags: string[];
  createdAt: string;
};

export type LedgerInput = {
  missionID?: string | null;
  taskID?: string | null;
  staffID?: string | null;
  sessionID?: string | null;
  provider?: string | null;
  model?: string | null;
  variant?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
};

export type MissionRow = {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  isolation: string | null;
  plan_json: string | null;
  plan_version: number;
  expected_cost_usd: number | null;
  actual_cost_usd: number;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
};

export type StaffRow = {
  id: string;
  persona: string;
  grade: string;
  agent: string | null;
  provider: string | null;
  model: string | null;
  variant: string | null;
  session_id: string | null;
  worktree_directory: string | null;
  worktree_base: string | null;
  score: number;
  status: string;
  reason: string | null;
  fired_at: string | null;
  evidence_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  mission_id: string;
  id: string;
  title: string;
  class: string;
  role: string;
  grade: string;
  status: string;
  acceptance_json: string;
  depends_on_json: string;
  capabilities_json: string | null;
  staff_id: string | null;
  session_id: string | null;
  assigned_at: string | null;
  reviewer_staff_id: string | null;
  reviewer_session_id: string | null;
  review_round: number;
  brief_json: string | null;
  report_json: string | null;
  verdict_json: string | null;
  raw_report: string | null;
  report_captured_at: string | null;
  snapshot_directory: string | null;
  merged_at: string | null;
  integration_commit: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
};

export type DisputeRow = {
  id: string;
  mission_id: string;
  task_id: string;
  status: string;
  round: number;
  claim: string;
  evidence_json: string | null;
  ruling_json: string | null;
  created_at: string;
  updated_at: string;
};

export type DisputeMessageRow = {
  id: number;
  dispute_id: string;
  role: string;
  text: string;
  evidence_json: string | null;
  created_at: string;
};

export type AuditRow = {
  id: string;
  mission_id: string;
  task_id: string;
  kind: string;
  status: string;
  reviewer_staff_id: string | null;
  reviewer_session_id: string | null;
  verdict_json: string | null;
  notes: string | null;
  created_at: string;
};

export type LessonRow = {
  id: number;
  mission_id: string | null;
  task_id: string | null;
  text: string;
  tags_json: string | null;
  created_at: string;
};

export function missionID(): string {
  return `m_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export function now(): string {
  return new Date().toISOString();
}

export function parseJSON<T>(text: string | null): T | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

export function mapMission(row: MissionRow): Mission {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    status: row.status,
    isolation: normalizeIsolation(row.isolation),
    planVersion: row.plan_version,
    expectedCostUsd: row.expected_cost_usd,
    actualCostUsd: row.actual_cost_usd,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
  };
}

export function mapStaff(row: StaffRow): Staff {
  return {
    id: row.id,
    persona: row.persona,
    grade: row.grade,
    agent: row.agent,
    provider: row.provider,
    model: row.model,
    variant: row.variant,
    sessionID: row.session_id,
    worktreeDirectory: row.worktree_directory,
    worktreeBase: row.worktree_base ?? null,
    score: row.score,
    status: row.status,
    reason: row.reason,
    firedAt: row.fired_at,
    evidenceRef: row.evidence_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    missionID: row.mission_id,
    title: row.title,
    class: row.class,
    role: row.role,
    grade: row.grade,
    status: row.status,
    acceptance: parseJSON<string[]>(row.acceptance_json) ?? [],
    dependsOn: parseJSON<string[]>(row.depends_on_json) ?? [],
    capabilities: parseJSON<string[]>(row.capabilities_json) ?? [],
    staffID: row.staff_id,
    sessionID: row.session_id,
    assignedAt: row.assigned_at,
    reviewerStaffID: row.reviewer_staff_id,
    reviewerSessionID: row.reviewer_session_id,
    reviewRound: row.review_round,
    brief: parseJSON<unknown>(row.brief_json),
    report: parseJSON<unknown>(row.report_json),
    verdict: parseJSON<unknown>(row.verdict_json),
    rawReport: row.raw_report,
    reportCapturedAt: row.report_captured_at,
    snapshotDirectory: row.snapshot_directory,
    mergedAt: row.merged_at,
    integrationCommit: row.integration_commit,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDispute(row: DisputeRow): Dispute {
  return {
    id: row.id,
    missionID: row.mission_id,
    taskID: row.task_id,
    status: row.status,
    round: row.round,
    claim: row.claim,
    evidence: parseJSON<unknown>(row.evidence_json),
    ruling: parseJSON<unknown>(row.ruling_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDisputeMessage(row: DisputeMessageRow): DisputeMessage {
  return {
    id: row.id,
    disputeID: row.dispute_id,
    role: row.role,
    text: row.text,
    evidence: parseJSON<unknown>(row.evidence_json),
    createdAt: row.created_at,
  };
}

export function mapAudit(row: AuditRow): Audit {
  return {
    id: row.id,
    missionID: row.mission_id,
    taskID: row.task_id,
    kind: row.kind,
    status: row.status,
    reviewerStaffID: row.reviewer_staff_id,
    reviewerSessionID: row.reviewer_session_id,
    verdict: parseJSON<unknown>(row.verdict_json),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function mapLesson(row: LessonRow): Lesson {
  return {
    id: row.id,
    missionID: row.mission_id,
    taskID: row.task_id,
    text: row.text,
    tags: parseJSON<string[]>(row.tags_json) ?? [],
    createdAt: row.created_at,
  };
}
