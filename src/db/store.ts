import type { Database } from "bun:sqlite";
import { DEFAULT_CONFIG, type SquadConfig } from "../config";
import type { MissionPlan } from "../plan";
import {
  ISOLATION_MODES,
  MISSION_STATUSES,
  normalizeIsolation,
  now,
  TERMINAL_MISSION_STATUSES,
  type Audit,
  type Dispute,
  type DisputeMessage,
  type Isolation,
  type LedgerInput,
  type Lesson,
  type Mission,
  type MissionStatus,
  type Staff,
  type Task,
} from "./model";
import { AuditRepository } from "./repositories/audits";
import { DisputeRepository } from "./repositories/disputes";
import { EventRepository } from "./repositories/events";
import { LedgerRepository } from "./repositories/ledger";
import { MissionRepository } from "./repositories/missions";
import { StaffRepository } from "./repositories/staff";
import { TaskRepository } from "./repositories/tasks";

export {
  ISOLATION_MODES,
  MISSION_STATUSES,
  TERMINAL_MISSION_STATUSES,
  type Audit,
  type Dispute,
  type DisputeMessage,
  type Isolation,
  type LedgerInput,
  type Lesson,
  type Mission,
  type MissionStatus,
  type Staff,
  type Task,
};

/**
 * Facade over focused repositories. The public API is unchanged: callers keep
 * using store.listTasks(...), store.assignTask(...) and so on. Each domain
 * lives in src/db/repositories/*, so schema changes no longer require editing
 * one 1.6k-line class.
 */
export class SquadStore {
  readonly missions: MissionRepository;
  readonly tasks: TaskRepository;
  readonly staff: StaffRepository;
  readonly ledger: LedgerRepository;
  readonly disputes: DisputeRepository;
  readonly audits: AuditRepository;
  readonly events: EventRepository;
  /** Live configuration: rework limit, budget radar and hard cost limit. */
  readonly config: SquadConfig;

  constructor(db: Database, config: SquadConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.missions = new MissionRepository(db, this);
    this.tasks = new TaskRepository(db, this);
    this.staff = new StaffRepository(db, this);
    this.ledger = new LedgerRepository(db, this);
    this.disputes = new DisputeRepository(db, this);
    this.audits = new AuditRepository(db, this);
    this.events = new EventRepository(db);
  }

  // Missions
  createMission(title: string, goal = "", isolation: Isolation = "worktree"): Mission {
    return this.missions.createMission(title, goal, normalizeIsolation(isolation));
  }

  listMissions(limit = 20): Mission[] {
    return this.missions.listMissions(limit);
  }

  getMission(id: string): Mission | undefined {
    return this.missions.getMission(id);
  }

  requireMission(id: string): Mission {
    return this.missions.requireMission(id);
  }

  listStaleMissions(idleMinutes?: number): Mission[] {
    return this.missions.listStaleMissions(idleMinutes);
  }

  countStaleMissions(idleMinutes?: number): number {
    return this.missions.countStaleMissions(idleMinutes);
  }

  getPlan(id: string): MissionPlan | null {
    return this.missions.getPlan(id);
  }

  submitPlan(
    id: string,
    plan: MissionPlan,
  ): { mission: Mission; plan: MissionPlan; version: number } {
    return this.missions.submitPlan(id, plan);
  }

  approvePlan(id: string, note = ""): Mission {
    return this.missions.approvePlan(id, note);
  }

  rejectPlan(id: string, note = ""): Mission {
    return this.missions.rejectPlan(id, note);
  }

  finalizeMission(id: string): Mission {
    return this.missions.finalizeMission(id);
  }

  abortMission(id: string, reason: string): Mission {
    return this.missions.abortMission(id, reason);
  }

  countMissions(): number {
    return this.missions.countMissions();
  }

  // Staff
  hireStaff(input: Parameters<StaffRepository["hireStaff"]>[0]): Staff {
    return this.staff.hireStaff(input);
  }

  listStaff(limit = 50): Staff[] {
    return this.staff.listStaff(limit);
  }

  getStaff(id: string): Staff | undefined {
    return this.staff.getStaff(id);
  }

  requireStaff(id: string): Staff {
    return this.staff.requireStaff(id);
  }

  listStaffWithWorktrees(): Staff[] {
    return this.staff.listStaffWithWorktrees();
  }

  clearWorktree(staffID: string): Staff {
    return this.staff.clearWorktree(staffID);
  }

  appraiseStaff(staffID: string, delta: number, note = ""): Staff {
    return this.staff.appraiseStaff(staffID, delta, note);
  }

  fireStaff(staffID: string, reason: string, evidenceRef: string): Staff {
    return this.staff.fireStaff(staffID, reason, evidenceRef);
  }

  isBlacklisted(persona: string, grade: string): boolean {
    return this.staff.isBlacklisted(persona, grade);
  }

  listAppraisals(staffID: string, limit = 50) {
    return this.staff.listAppraisals(staffID, limit);
  }

  scorecard(staffID: string) {
    return this.staff.scorecard(staffID);
  }

  changeGrade(staffID: string, direction: "up" | "down"): Staff {
    return this.staff.changeGrade(staffID, direction);
  }

  countBlacklist(): number {
    return this.staff.countBlacklist();
  }

  countStaff(): number {
    return this.staff.countStaff();
  }

  // Tasks
  listTasks(missionID: string): Task[] {
    return this.tasks.listTasks(missionID);
  }

  getTask(missionID: string, taskID: string): Task | undefined {
    return this.tasks.getTask(missionID, taskID);
  }

  requireTask(missionID: string, taskID: string): Task {
    return this.tasks.requireTask(missionID, taskID);
  }

  listTasksByStaff(staffID: string): Task[] {
    return this.tasks.listTasksByStaff(staffID);
  }

  assignTask(missionID: string, taskID: string, staffID: string, brief: unknown): Task {
    return this.tasks.assignTask(missionID, taskID, staffID, brief);
  }

  markTaskRunning(missionID: string, taskID: string): Task {
    return this.tasks.markTaskRunning(missionID, taskID);
  }

  saveRawReport(missionID: string, taskID: string, rawReport: string): Task {
    return this.tasks.saveRawReport(missionID, taskID, rawReport);
  }

  setTaskSnapshot(missionID: string, taskID: string, directory: string): Task {
    return this.tasks.setTaskSnapshot(missionID, taskID, directory);
  }

  completeTask(missionID: string, taskID: string, report: unknown): Task {
    return this.tasks.completeTask(missionID, taskID, report);
  }

  assignReview(
    missionID: string,
    taskID: string,
    reviewerStaffID: string,
    reviewerSessionID: string,
  ): Task {
    return this.tasks.assignReview(missionID, taskID, reviewerStaffID, reviewerSessionID);
  }

  resetReview(missionID: string, taskID: string, reason: string): Task {
    return this.tasks.resetReview(missionID, taskID, reason);
  }

  saveVerdict(missionID: string, taskID: string, verdict: unknown): Task {
    return this.tasks.saveVerdict(missionID, taskID, verdict);
  }

  markMerged(missionID: string, taskID: string, commit: string, sourceCommit?: string): Task {
    return this.tasks.markMerged(missionID, taskID, commit, sourceCommit);
  }

  markMergedInPlace(missionID: string, taskID: string): Task {
    return this.tasks.markMergedInPlace(missionID, taskID);
  }

  unmarkMerged(missionID: string, taskID: string, reason: string): Task {
    return this.tasks.unmarkMerged(missionID, taskID, reason);
  }

  failTask(missionID: string, taskID: string, reason: string): Task {
    return this.tasks.failTask(missionID, taskID, reason);
  }

  countTasks(missionID?: string): number {
    return this.tasks.countTasks(missionID);
  }

  listDependents(missionID: string, taskID: string): Task[] {
    return this.tasks.listDependents(missionID, taskID);
  }

  // Events
  addEvent(
    missionIDValue: string | null,
    taskID: string | null,
    type: string,
    payload: unknown,
  ): void {
    this.events.addEvent(missionIDValue, taskID, type, payload);
  }

  listEvents(missionID: string, limit = 100) {
    return this.events.listEvents(missionID, limit);
  }

  countEvents(missionID: string): number {
    return this.events.countEvents(missionID);
  }

  // Ledger
  hasLedgerEntry(missionID: string, taskID: string, sessionID: string): boolean {
    return this.ledger.hasLedgerEntry(missionID, taskID, sessionID);
  }

  recordLedger(input: LedgerInput): void {
    this.ledger.recordLedger(input);
  }

  budgetSummary(missionID?: string) {
    return this.ledger.budgetSummary(missionID);
  }

  // Disputes and lessons
  openDispute(missionID: string, taskID: string, claim: string, evidence?: unknown): Dispute {
    return this.disputes.openDispute(missionID, taskID, claim, evidence);
  }

  getDispute(id: string): Dispute | undefined {
    return this.disputes.getDispute(id);
  }

  requireDispute(id: string): Dispute {
    return this.disputes.requireDispute(id);
  }

  listDisputes(missionID: string): Dispute[] {
    return this.disputes.listDisputes(missionID);
  }

  listDisputeMessages(disputeID: string): DisputeMessage[] {
    return this.disputes.listDisputeMessages(disputeID);
  }

  replyDispute(disputeID: string, role: string, text: string, evidence?: unknown): Dispute {
    return this.disputes.replyDispute(disputeID, role, text, evidence);
  }

  saveRuling(disputeID: string, ruling: unknown): Dispute {
    return this.disputes.saveRuling(disputeID, ruling);
  }

  addLesson(
    missionID: string | null,
    taskID: string | null,
    text: string,
    tags: string[] = [],
  ): void {
    this.disputes.addLesson(missionID, taskID, text, tags);
  }

  listLessons(missionID?: string): Lesson[] {
    return this.disputes.listLessons(missionID);
  }

  countDisputes(): number {
    return this.disputes.countDisputes();
  }

  countLessons(): number {
    return this.disputes.countLessons();
  }

  // Audits
  recordAudit(input: Parameters<AuditRepository["recordAudit"]>[0]): Audit {
    return this.audits.recordAudit(input);
  }

  getAudit(id: string): Audit | undefined {
    return this.audits.getAudit(id);
  }

  requireAudit(id: string): Audit {
    return this.audits.requireAudit(id);
  }

  listAudits(missionID: string): Audit[] {
    return this.audits.listAudits(missionID);
  }

  hasAudit(missionID: string, taskID: string): boolean {
    return this.audits.hasAudit(missionID, taskID);
  }

  countAudits(): number {
    return this.audits.countAudits();
  }

  tuiState(missionID?: string) {
    const missions = this.listMissions(20);
    const mission = missionID ? this.requireMission(missionID) : missions[0];
    const tasks = mission ? this.listTasks(mission.id) : [];
    return {
      generatedAt: now(),
      missions,
      mission: mission ?? null,
      plan: mission ? this.getPlan(mission.id) : null,
      tasks: tasks.map(({ brief, rawReport, ...task }) => task),
      staff: this.listStaff(50),
      budget: mission ? this.budgetSummary(mission.id) : this.budgetSummary(),
      audits: mission ? this.listAudits(mission.id) : [],
      disputes: mission ? this.listDisputes(mission.id) : [],
      lessons: mission ? this.listLessons(mission.id) : [],
    };
  }
}
