import type { Mission, Staff, Task } from "../db/model";
import { isTerminalMissionStatus } from "../db/model";

export type WorktreeReason = "no_tasks" | "mission_missing" | "mission_terminal" | "mission_stale";

export type WorktreeCandidate = {
  staffID: string;
  persona: string;
  directory: string;
  missionIDs: string[];
  reason: WorktreeReason;
};

export type WorktreePlanInput = {
  staff: Staff[];
  tasksByStaff: Map<string, Task[]>;
  missions: Map<string, Mission>;
  staleMissionIDs: Set<string>;
};

/**
 * Pure planning step for the janitor. A worktree is safe to remove when every
 * task that used it belongs to a terminal, missing or stale mission. Live
 * missions keep their isolation until integrate/finalize/cancel removes it.
 */
export function planWorktreeSweep(input: WorktreePlanInput): WorktreeCandidate[] {
  const candidates: WorktreeCandidate[] = [];

  for (const employee of input.staff) {
    const directory = employee.worktreeDirectory;
    if (!directory) continue;

    const tasks = input.tasksByStaff.get(employee.id) ?? [];
    if (tasks.length === 0) {
      candidates.push({
        staffID: employee.id,
        persona: employee.persona,
        directory,
        missionIDs: [],
        reason: "no_tasks",
      });
      continue;
    }

    const missionIDs = [...new Set(tasks.map((task) => task.missionID))];
    const missions = missionIDs.map((id) => input.missions.get(id));
    const missing = missions.some((mission) => !mission);
    if (missing) {
      candidates.push({
        staffID: employee.id,
        persona: employee.persona,
        directory,
        missionIDs,
        reason: "mission_missing",
      });
      continue;
    }

    const live = missions.filter(
      (mission): mission is Mission =>
        !!mission && !isTerminalMissionStatus(mission.status) && !input.staleMissionIDs.has(mission.id),
    );
    if (live.length > 0) continue;

    const stale = missions.some((mission) => !!mission && input.staleMissionIDs.has(mission.id));
    candidates.push({
      staffID: employee.id,
      persona: employee.persona,
      directory,
      missionIDs,
      reason: stale ? "mission_stale" : "mission_terminal",
    });
  }

  return candidates;
}
