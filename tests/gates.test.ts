import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "../src/config";
import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";
import { taskDiff } from "../src/runtime/diff";
import { registerIntegrateTool } from "../src/tools/integrate";
import { registerPlanTool } from "../src/tools/plan";
import { registerTasksTool } from "../src/tools/tasks";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
}

type Captured = {
  execute: (input: unknown, context: unknown) => Promise<{ content: string }>;
};

function toolContext(options: {
  permissionAssert?: (input: unknown) => Promise<void>;
  worktreeRemove?: (input: unknown) => Promise<unknown>;
  directory: string;
}) {
  let captured: Captured | undefined;
  const asserts: unknown[] = [];
  const ctx = {
    location: {
      directory: options.directory,
      workspaceID: "ws",
      project: { id: "test-project", canonical: options.directory },
    },
    permission: {
      assert: async (input: unknown) => {
        asserts.push(input);
        if (options.permissionAssert) await options.permissionAssert(input);
      },
    },
    worktree: {
      remove: async (input: unknown) => {
        if (options.worktreeRemove) return options.worktreeRemove(input);
        return { directory: (input as { directory: string }).directory, removed: true };
      },
    },
    session: {
      get: async () => ({ id: "ses_x", location: { directory: options.directory } }),
    },
    tool: {
      transform: async (factory: (editor: unknown) => unknown) => {
        factory({
          namespace: () => undefined,
          add: (tool: Captured) => {
            captured = tool;
          },
        });
        return { dispose: async () => undefined };
      },
    },
  };
  return { ctx, asserts, get tool(): Captured {
    if (!captured) throw new Error("tool was not registered");
    return captured;
  } };
}

const TOOL_CONTEXT = {
  sessionID: "ses_boss",
  agent: "build",
  messageID: "msg_1",
  id: "call_1",
};

function approvedMission(store: SquadStore, tasks = 1) {
  const mission = store.createMission("gates", "gate fixture");
  store.submitPlan(mission.id, {
    goal: "gate fixture",
    expectedCostUsd: 1,
    tasks: Array.from({ length: tasks }, (_, index) => ({
      id: `t${index + 1}`,
      title: `task ${index + 1}`,
      class: "code" as const,
      role: "implementer",
      grade: "G2" as const,
      acceptance: ["done"],
    })),
  });
  store.approvePlan(mission.id);
  return mission;
}

function hire(store: SquadStore, worktreeDirectory?: string, worktreeBase?: string) {
  return store.hireStaff({
    persona: "implementer",
    grade: "G2",
    agent: "build",
    provider: "deepseek",
    model: "deepseek-flash",
    variant: "high",
    sessionID: `ses_${Math.random().toString(16).slice(2)}`,
    worktreeDirectory,
    worktreeBase,
  });
}

describe("live configuration", () => {
  let directory: string;
  let db: Database;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-gates-db-"));
    db = openSquadDb(directory);
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("maxRework from the config drives the escalation gate", () => {
    const store = new SquadStore(db, { ...DEFAULT_CONFIG, maxRework: 0 });
    const mission = approvedMission(store);
    const staff = hire(store);
    store.assignTask(mission.id, "t1", staff.id, { goal: "x" });
    store.markTaskRunning(mission.id, "t1");
    store.saveRawReport(mission.id, "t1", '{"status":"done"}');
    store.assignReview(mission.id, "t1", staff.id, "ses_reviewer");
    store.saveVerdict(mission.id, "t1", {
      verdict: "fail",
      severity: "high",
      findings: [{ id: "F1", claim: "c", evidence: "e", required_fix: "f" }],
      checked: ["diff"],
    });

    expect(() => store.assignTask(mission.id, "t1", staff.id, { goal: "y" })).toThrow(
      "rework limit exceeded for task t1 (max 0)",
    );
    expect(store.requireTask(mission.id, "t1").status).toBe("escalated");
  });

  test("hardLimitUsd blocks a new assignment once the mission is over budget", () => {
    const store = new SquadStore(db, { ...DEFAULT_CONFIG, hardLimitUsd: 0.01 });
    const mission = approvedMission(store);
    const staff = hire(store);
    store.recordLedger({ missionID: mission.id, taskID: "t1", cost: 0.02 });

    expect(() => store.assignTask(mission.id, "t1", staff.id, { goal: "x" })).toThrow(
      "mission budget hard limit reached",
    );
    expect(store.listEvents(mission.id).some((event) => event.type === "budget.hard_limit")).toBe(
      true,
    );
  });

  test("softWarnPct from the config drives the budget radar", () => {
    const store = new SquadStore(db, { ...DEFAULT_CONFIG, softWarnPct: [50, 80] });
    const mission = approvedMission(store);
    store.recordLedger({ missionID: mission.id, cost: 0.6 });

    const budget = store.budgetSummary(mission.id);
    expect(budget.warnings).toContain("50% of expected");
    expect(budget.warnings).not.toContain("80% of expected");
  });
});

describe("audit scoping", () => {
  let directory: string;
  let db: Database;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-gates-audit-"));
    db = openSquadDb(directory);
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("a process audit does not block auditing a task literally named mission", () => {
    const store = new SquadStore(db);
    const mission = store.createMission("audit", "audit fixture");
    store.submitPlan(mission.id, {
      goal: "audit fixture",
      tasks: [
        {
          id: "mission",
          title: "mission named task",
          class: "code",
          role: "implementer",
          grade: "G2",
          acceptance: ["done"],
        },
      ],
    });
    store.approvePlan(mission.id);

    store.recordAudit({
      missionID: mission.id,
      taskID: "mission",
      kind: "process",
      status: "pass",
      notes: "process ok",
    });
    expect(store.hasAudit(mission.id, "mission")).toBe(false);

    store.recordAudit({
      missionID: mission.id,
      taskID: "mission",
      kind: "second_review",
      status: "pass",
      notes: "second review ok",
    });
    expect(store.hasAudit(mission.id, "mission")).toBe(true);
  });
});

describe("worktree diff baseline", () => {
  let repo: string;
  let directory: string;
  let db: Database;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "squad-gates-repo-"));
    git(repo, ["init", "-b", "main"]);
    git(repo, ["config", "user.email", "test@example.com"]);
    git(repo, ["config", "user.name", "SQUAD Test"]);
    writeFileSync(join(repo, "base.txt"), "base\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "base"]);
    directory = mkdtempSync(join(tmpdir(), "squad-gates-db2-"));
    db = openSquadDb(directory);
  });

  afterEach(() => {
    db.close();
    rmSync(repo, { recursive: true, force: true });
    rmSync(directory, { recursive: true, force: true });
  });

  test("every worker commit since the branch base reaches the reviewer", async () => {
    const base = git(repo, ["rev-parse", "HEAD"]).trim();
    writeFileSync(join(repo, "poster.svg"), "<svg/>\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "squad(t1): poster"]);
    writeFileSync(join(repo, "late.txt"), "late\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "squad(t1): late change"]);

    const store = new SquadStore(db);
    const mission = approvedMission(store);
    const staff = hire(store, repo, base);
    store.assignTask(mission.id, "t1", staff.id, { goal: "poster" });
    const task = store.markTaskRunning(mission.id, "t1");

    const diff = (await taskDiff(
      { location: { directory: repo } } as never,
      store,
      task,
    )) as {
      worktree: { base: string };
      data: Array<{ file: string; patch: string }>;
    };

    expect(diff.worktree.base).toBe(base);
    expect(diff.data.map((entry) => entry.file).sort()).toEqual(["late.txt", "poster.svg"]);
    expect(diff.data.find((entry) => entry.file === "poster.svg")?.patch).toContain("<svg/>");
  });
});

describe("integration batch is all-or-nothing", () => {
  let root: string;
  let main: string;
  let wt1: string;
  let wt2: string;
  let dbDir: string;
  let db: Database;
  let store: SquadStore;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "squad-gates-int-"));
    main = join(root, "main");
    wt1 = join(root, "wt1");
    wt2 = join(root, "wt2");
    mkdirSync(main);
    git(main, ["init", "-b", "main"]);
    git(main, ["config", "user.email", "test@example.com"]);
    git(main, ["config", "user.name", "SQUAD Test"]);
    writeFileSync(join(main, "shared.txt"), "base\n");
    git(main, ["add", "."]);
    git(main, ["commit", "-m", "base"]);

    git(main, ["worktree", "add", "-b", "w1", wt1]);
    writeFileSync(join(wt1, "shared.txt"), "w1\n");
    git(wt1, ["commit", "-am", "w1 change"]);

    git(main, ["worktree", "add", "-b", "w2", wt2]);
    writeFileSync(join(wt2, "shared.txt"), "w2\n");
    git(wt2, ["commit", "-am", "w2 change"]);

    dbDir = mkdtempSync(join(tmpdir(), "squad-gates-int-db-"));
    db = openSquadDb(dbDir);
    store = new SquadStore(db);
  });

  afterEach(() => {
    db.close();
    for (const worktree of [wt1, wt2]) {
      try {
        git(main, ["worktree", "remove", "--force", worktree]);
      } catch {
        // already removed
      }
    }
    rmSync(root, { recursive: true, force: true });
    rmSync(dbDir, { recursive: true, force: true });
  });

  test("a conflicting second cherry-pick rewinds main and unmarks the first task", async () => {
    const mission = approvedMission(store, 2);
    const first = hire(store, wt1);
    const second = hire(store, wt2);
    const baseHead = git(main, ["rev-parse", "HEAD"]).trim();

    store.assignTask(mission.id, "t1", first.id, { goal: "one" });
    store.assignTask(mission.id, "t2", second.id, { goal: "two" });
    db.query("UPDATE tasks SET status = 'integrated' WHERE mission_id = ?").run(mission.id);
    db.query("UPDATE missions SET status = 'integrating' WHERE id = ?").run(mission.id);

    const harness = toolContext({ directory: main });
    await registerIntegrateTool(harness.ctx as never, store);
    const result = await harness.tool.execute({ mission_id: mission.id }, TOOL_CONTEXT);
    const payload = JSON.parse(result.content) as { ok: boolean; error?: string };

    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("rolled back");
    expect(git(main, ["rev-parse", "HEAD"]).trim()).toBe(baseHead);
    expect(git(main, ["status", "--porcelain"]).trim()).toBe("");
    expect(store.requireTask(mission.id, "t1").mergedAt).toBeNull();
    expect(store.requireTask(mission.id, "t2").mergedAt).toBeNull();
  });
});

describe("permission gates", () => {
  let directory: string;
  let db: Database;
  let store: SquadStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-gates-perm-"));
    db = openSquadDb(directory);
    store = new SquadStore(db);
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("plan approve asks the permission system", async () => {
    const mission = store.createMission("perm", "perm fixture");
    store.submitPlan(mission.id, {
      goal: "perm",
      tasks: [
        {
          id: "t1",
          title: "one",
          class: "code",
          role: "implementer",
          grade: "G2",
          acceptance: ["done"],
        },
      ],
    });

    const harness = toolContext({ directory });
    await registerPlanTool(harness.ctx as never, store);
    const result = await harness.tool.execute(
      { mission_id: mission.id, action: "approve" },
      TOOL_CONTEXT,
    );
    const payload = JSON.parse(result.content) as { ok: boolean };

    expect(payload.ok).toBe(true);
    expect(harness.asserts).toHaveLength(1);
    expect((harness.asserts[0] as { action: string }).action).toBe("squad_plan");
    expect(store.requireMission(mission.id).status).toBe("staffing");
  });

  test("a denied permission stops the approve", async () => {
    const mission = store.createMission("perm-denied", "perm fixture");
    store.submitPlan(mission.id, {
      goal: "perm",
      tasks: [
        {
          id: "t1",
          title: "one",
          class: "code",
          role: "implementer",
          grade: "G2",
          acceptance: ["done"],
        },
      ],
    });

    const harness = toolContext({
      directory,
      permissionAssert: async () => {
        throw new Error("permission denied");
      },
    });
    await registerPlanTool(harness.ctx as never, store);
    const result = await harness.tool.execute(
      { mission_id: mission.id, action: "approve" },
      TOOL_CONTEXT,
    );
    const payload = JSON.parse(result.content) as { ok: boolean; error?: string };

    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("permission denied");
    expect(store.requireMission(mission.id).status).toBe("plan_gate");
  });

  test("tasks reports failed work that needs attention", async () => {
    const mission = approvedMission(store);
    const staff = hire(store);
    store.assignTask(mission.id, "t1", staff.id, { goal: "x" });
    store.failTask(mission.id, "t1", "timeout");

    const harness = toolContext({ directory });
    await registerTasksTool(harness.ctx as never, store);
    const result = await harness.tool.execute({ mission_id: mission.id }, TOOL_CONTEXT);
    const payload = JSON.parse(result.content) as {
      needs_attention: boolean;
      attention: Array<{ id: string; status: string; attempts: number }>;
      mission_status: string;
    };

    expect(payload.needs_attention).toBe(true);
    expect(payload.attention).toEqual([{ id: "t1", status: "failed", attempts: 0 }]);
    expect(payload.mission_status).toBe("executing");
  });
});
