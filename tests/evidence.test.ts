import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Task } from "../src/db/model";
import { isAncestor, missionEvidence, taskEvidence } from "../src/runtime/evidence";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
}

function commit(cwd: string, file: string, text: string, message: string): string {
  writeFileSync(join(cwd, file), text);
  git(cwd, ["add", file]);
  git(cwd, ["commit", "-m", message]);
  return git(cwd, ["rev-parse", "HEAD"]).trim();
}

let root: string;
let main: string;
let mergedCommit: string;
let orphanCommit: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "squad-evidence-"));
  main = join(root, "main");
  mkdirSync(main);
  git(main, ["init", "-b", "main"]);
  git(main, ["config", "user.email", "test@example.com"]);
  git(main, ["config", "user.name", "SQUAD Test"]);
  commit(main, "base.txt", "base\n", "base");
  mergedCommit = commit(main, "feature.txt", "feature\n", "feature");

  git(main, ["checkout", "-b", "orphan", "HEAD~1"]);
  orphanCommit = commit(main, "orphan.txt", "orphan\n", "orphan");
  git(main, ["checkout", "main"]);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t_1",
    missionID: "m_1",
    title: "task",
    class: "code",
    role: "implementer",
    grade: "G2",
    status: "integrated",
    acceptance: [],
    dependsOn: [],
    capabilities: [],
    paths: [],
    staffID: null,
    sessionID: null,
    assignedAt: null,
    reviewerStaffID: null,
    reviewerSessionID: null,
    reviewRound: 1,
    brief: null,
    report: null,
    verdict: null,
    rawReport: null,
    reportCapturedAt: null,
    snapshotDirectory: null,
    mergedAt: null,
    integrationCommit: null,
    attempts: 0,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("integration evidence", () => {
  test("detects an ancestor commit and a merged task", () => {
    const evidence = taskEvidence(
      main,
      task({ mergedAt: "2026-11-14T00:00:00.000Z", integrationCommit: mergedCommit }),
    );
    expect(evidence.ancestorOfMain).toBe(true);
    expect(evidence.problems).toEqual([]);
  });

  test("flags a commit that never reached main", () => {
    expect(isAncestor(main, orphanCommit)).toBe(false);
    const evidence = taskEvidence(
      main,
      task({ mergedAt: "2026-11-14T00:00:00.000Z", integrationCommit: orphanCommit }),
    );
    expect(evidence.ancestorOfMain).toBe(false);
    expect(evidence.problems.join(" ")).toContain("not an ancestor of main HEAD");
  });

  test("flags an integrated task without an integration commit", () => {
    const evidence = taskEvidence(main, task());
    expect(evidence.problems.join(" ")).toContain("no integration commit");
  });

  test("reports extra review rounds without failing deterministically", () => {
    const evidence = taskEvidence(
      main,
      task({
        mergedAt: "2026-11-14T00:00:00.000Z",
        integrationCommit: mergedCommit,
        reviewRound: 3,
        attempts: 0,
      }),
    );
    expect(evidence.reviewRoundsWithoutRework).toBe(2);
    expect(evidence.problems).toEqual([]);
  });

  test("mission evidence aggregates problems", () => {
    const evidence = missionEvidence(main, [
      task({ id: "t_ok", mergedAt: "x", integrationCommit: mergedCommit }),
      task({ id: "t_bad", mergedAt: "x", integrationCommit: orphanCommit }),
    ]);
    expect(evidence.ok).toBe(false);
    expect(evidence.problems).toHaveLength(1);
  });
});
