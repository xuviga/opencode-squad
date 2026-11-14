import { spawnSync } from "node:child_process";
import type { Task } from "../db/model";

export type EvidenceOptions = {
  isolation?: "worktree" | "none";
};

export type TaskEvidence = {
  taskID: string;
  status: string;
  inPlace: boolean;
  mergedAt: string | null;
  integrationCommit: string | null;
  /** True when integrationCommit is reachable from the main checkout HEAD. */
  ancestorOfMain: boolean;
  reportCapturedAt: string | null;
  reviewRound: number;
  attempts: number;
  /**
   * Rounds beyond the expected `attempts + 1`. Disputes and reviewer resets can
   * legitimately add rounds, so this is a signal for the process auditor, not
   * an automatic fail.
   */
  reviewRoundsWithoutRework: number;
  /** Deterministic blockers: an integrated task whose commit is not in main. */
  problems: string[];
};

function gitStatus(cwd: string, args: string[]) {
  return spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
}

/** `git merge-base --is-ancestor <commit> HEAD` in the main checkout. */
export function isAncestor(mainDirectory: string, commit: string, ref = "HEAD"): boolean {
  if (!commit.trim()) return false;
  const result = gitStatus(mainDirectory, ["merge-base", "--is-ancestor", commit, ref]);
  return result.status === 0;
}

export function taskEvidence(
  mainDirectory: string,
  task: Task,
  options: EvidenceOptions = {},
): TaskEvidence {
  const inPlace = options.isolation === "none";
  const problems: string[] = [];
  let ancestorOfMain = false;

  if (!inPlace && task.status === "integrated" && !task.mergedAt) {
    problems.push(`task ${task.id} is integrated but has no integration commit (not merged)`);
  }

  if (!inPlace && task.integrationCommit) {
    ancestorOfMain = isAncestor(mainDirectory, task.integrationCommit);
    if (!ancestorOfMain) {
      problems.push(
        `integration commit ${task.integrationCommit} of ${task.id} is not an ancestor of main HEAD`,
      );
    }
  }

  return {
    taskID: task.id,
    status: task.status,
    inPlace,
    mergedAt: task.mergedAt,
    integrationCommit: task.integrationCommit,
    ancestorOfMain,
    reportCapturedAt: task.reportCapturedAt,
    reviewRound: task.reviewRound,
    attempts: task.attempts,
    reviewRoundsWithoutRework: Math.max(0, task.reviewRound - (task.attempts + 1)),
    problems,
  };
}

export function missionEvidence(
  mainDirectory: string,
  tasks: Task[],
  options: EvidenceOptions = {},
) {
  const tasksEvidence = tasks.map((task) => taskEvidence(mainDirectory, task, options));
  const problems = tasksEvidence.flatMap((evidence) => evidence.problems);
  return {
    ok: problems.length === 0,
    tasks: tasksEvidence,
    problems,
    suspiciousReviewRounds: tasksEvidence
      .filter((evidence) => evidence.reviewRoundsWithoutRework > 0)
      .map((evidence) => evidence.taskID),
  };
}
