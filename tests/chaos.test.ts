import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";
import { registerWaitTool } from "../src/tools/wait";

let directory: string;
let db: Database;
let store: SquadStore;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "squad-chaos-"));
  db = openSquadDb(directory);
  store = new SquadStore(db);
});

afterEach(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const mission = store.createMission("Chaos", "Chaos fixture");
  store.submitPlan(mission.id, {
    goal: "Chaos fixture",
    tasks: [
      {
        id: "t1",
        title: "Chaos task",
        class: "code",
        role: "implementer",
        grade: "G2",
        acceptance: ["done"],
      },
    ],
  });
  store.approvePlan(mission.id);
  const staff = store.hireStaff({
    persona: "implementer",
    grade: "G2",
    agent: "build",
    provider: "deepseek",
    model: "deepseek-flash",
    variant: "high",
    sessionID: "ses_chaos",
  });
  store.assignTask(mission.id, "t1", staff.id, { goal: "chaos" });
  store.markTaskRunning(mission.id, "t1");
  return mission;
}

describe("chaos", () => {
  test("a crashed worker session fails the task and records the ledger", async () => {
    const mission = fixture();
    const interrupts: unknown[] = [];
    let captured:
      | { execute: (input: unknown, context: unknown) => Promise<{ content: string }> }
      | undefined;

    const ctx = {
      permission: { assert: async () => undefined },
      session: {
        wait: async () => {
          throw new Error("SessionCrashed: worker process exited with code 1");
        },
        get: async () => ({
          id: "ses_chaos",
          outcome: "failed",
          cost: 0.004,
          tokens: { input: 5, output: 4, reasoning: 0, cache: { read: 0, write: 0 } },
        }),
        context: async () => [],
        interrupt: async (input: unknown) => {
          interrupts.push(input);
        },
      },
      tool: {
        transform: async (fn: (editor: unknown) => unknown) => {
          fn({
            add: (tool: typeof captured) => {
              captured = tool;
            },
          });
          return { dispose: async () => undefined };
        },
      },
    };

    await registerWaitTool(ctx as never, store);
    const result = await captured!.execute(
      { mission_id: mission.id, task_id: "t1", timeout_ms: 5000 },
      { sessionID: "ses_boss", agent: "build", messageID: "msg", id: "call" },
    );
    const payload = JSON.parse(result.content) as {
      timedOut: boolean;
      task: { status: string };
      error: string;
    };

    expect(payload.timedOut).toBe(false);
    expect(payload.error).toContain("SessionCrashed");
    expect(payload.task.status).toBe("failed");
    expect(interrupts).toHaveLength(1);
    expect(store.budgetSummary(mission.id).actualCostUsd).toBeCloseTo(0.004, 5);
  });

  test("duplicate review and duplicate verdict are rejected", () => {
    const mission = fixture();
    store.saveRawReport(mission.id, "t1", '{"status":"done"}');
    store.assignReview(mission.id, "t1", "s_reviewer", "ses_reviewer");
    expect(() =>
      store.assignReview(mission.id, "t1", "s_reviewer2", "ses_reviewer2"),
    ).toThrow("cannot review task in status in_review");

    const verdict = {
      verdict: "pass",
      severity: "low",
      findings: [],
      checked: ["diff", "tests"],
    };
    store.saveVerdict(mission.id, "t1", verdict);
    expect(store.requireTask(mission.id, "t1").status).toBe("integrated");
    expect(() => store.saveVerdict(mission.id, "t1", verdict)).toThrow(
      "cannot save verdict in task status integrated",
    );
  });
});
