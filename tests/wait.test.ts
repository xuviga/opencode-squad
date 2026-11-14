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
  directory = mkdtempSync(join(tmpdir(), "squad-wait-"));
  db = openSquadDb(directory);
  store = new SquadStore(db);
});

afterEach(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const mission = store.createMission("Wait timeout", "Test the wait timeout path");
  store.submitPlan(mission.id, {
    goal: "Test the wait timeout path",
    tasks: [
      {
        id: "t1",
        title: "Stuck task",
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
    sessionID: "ses_worker",
  });
  store.assignTask(mission.id, "t1", staff.id, { goal: "stuck" });
  store.markTaskRunning(mission.id, "t1");
  return { mission, staff };
}

describe("squad_wait timeout", () => {
  test("marks a timed-out task failed, records the ledger and interrupts the worker", async () => {
    const { mission } = fixture();
    const interrupts: unknown[] = [];

    let captured: { execute: (input: unknown, context: unknown) => Promise<{ content: string }> } | undefined;
    const ctx = {
      permission: { assert: async () => undefined },
      session: {
        wait: async () => {
          throw new Error("TimeoutError: The operation was aborted due to timeout");
        },
        get: async () => ({
          id: "ses_worker",
          outcome: "running",
          cost: 0.01,
          tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0, write: 0 } },
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
    expect(captured).toBeDefined();

    const result = await captured!.execute(
      { mission_id: mission.id, task_id: "t1", timeout_ms: 5000 },
      { sessionID: "ses_boss", agent: "build", messageID: "msg_1", id: "call_1" },
    );
    const payload = JSON.parse(result.content) as {
      ok: boolean;
      timedOut: boolean;
      task: { status: string };
      error: string;
    };

    expect(payload.ok).toBe(true);
    expect(payload.timedOut).toBe(true);
    expect(payload.error).toContain("TimeoutError");
    expect(payload.task.status).toBe("failed");
    expect(store.requireTask(mission.id, "t1").status).toBe("failed");
    expect(interrupts).toHaveLength(1);
    expect(store.budgetSummary(mission.id).actualCostUsd).toBeCloseTo(0.01, 5);
  });
});
