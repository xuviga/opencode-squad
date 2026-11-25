import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireSquadDb, closeSharedHandles, openSquadDb, sharedHandleCount } from "../src/db/index";
import { SquadStore } from "../src/db/store";
import {
  attributeInPlace,
  pathMatches,
  partitionDiff,
  scopeViolations,
} from "../src/runtime/scope";
import { probeWorktree, resetWorktreeProbeCache } from "../src/runtime/worktree";

describe("shared database handle", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-shared-"));
    closeSharedHandles();
  });

  afterEach(() => {
    closeSharedHandles();
    rmSync(directory, { recursive: true, force: true });
  });

  test("a released handle stays usable for in-flight tool calls", () => {
    const first = acquireSquadDb(directory);
    const second = acquireSquadDb(directory);
    expect(second.db).toBe(first.db);
    expect(sharedHandleCount()).toBe(1);

    const store = new SquadStore(first.db);
    store.createMission("still open", "", "none");

    first.release();
    expect(() => store.countMissions()).not.toThrow();
    expect(store.countMissions()).toBe(1);

    second.release();
    expect(() => store.countMissions()).not.toThrow();
  });

  test("openSquadDb keeps returning an independent handle for tests", () => {
    const a = openSquadDb(directory);
    const b = openSquadDb(directory);
    expect(a).not.toBe(b);
    a.close();
    b.close();
  });
});

describe("path allowlist", () => {
  test("matches exact paths, directory prefixes and globs", () => {
    expect(pathMatches("README.md", "README.md")).toBe(true);
    expect(pathMatches("README.md", "docs/README.md")).toBe(false);
    expect(pathMatches("docs/POSITIONING.md", "docs/")).toBe(true);
    expect(pathMatches("docs/nested/file.md", "docs/")).toBe(true);
    expect(pathMatches("src/a/b.ts", "src/**/*.ts")).toBe(true);
    expect(pathMatches("src/a.ts", "src/**/*.ts")).toBe(true);
    expect(pathMatches("src/a.js", "src/**/*.ts")).toBe(false);
    expect(pathMatches("src\\a\\b.ts", "src/**/*.ts")).toBe(true);
  });

  test("partitions a folder-wide diff into owned and sibling files", () => {
    const diff = {
      data: [
        { file: "docs/POSITIONING.md", status: "added", patch: "+x" },
        { file: "README.md", status: "modified", patch: "-a" },
        { file: "package.json", status: "modified", patch: "-b" },
      ],
    };
    const scoped = partitionDiff(diff, ["docs/"]);
    expect(scoped.inScope).toEqual(["docs/POSITIONING.md"]);
    expect(scoped.outOfScope).toEqual(["README.md", "package.json"]);
    expect((scoped.diff as { data: unknown[] }).data).toHaveLength(1);
  });

  test("an empty allowlist keeps the whole diff", () => {
    const diff = { data: [{ file: "README.md" }] };
    const scoped = partitionDiff(diff, []);
    expect(scoped.outOfScope).toEqual([]);
    expect(scoped.inScope).toEqual(["README.md"]);
  });

  test("scopeViolations lists only files the task does not own", () => {
    const diff = {
      data: [{ file: "src/app.ts" }, { file: "README.md" }, { file: "docs/x.md" }],
    };
    expect(scopeViolations(["src/", "docs/"], diff)).toEqual(["README.md"]);
    expect(scopeViolations([], diff)).toEqual([]);
  });

  test("in-place attribution separates mine, sibling and unclaimed files", () => {
    const diff = {
      data: [{ file: "src/a.ts" }, { file: "docs/b.md" }, { file: "secret.txt" }],
    };
    const result = attributeInPlace(diff, ["src/"], [
      { id: "other", paths: ["docs/"], concurrent: true },
    ]);
    expect(result.mine).toEqual(["src/a.ts"]);
    expect(result.siblingFiles).toEqual(["docs/b.md"]);
    expect(result.unclaimed).toEqual(["secret.txt"]);
    expect(result.enforceable).toBe(true);
  });

  test("attribution is advisory when a concurrent writer declares no paths", () => {
    const diff = { data: [{ file: "src/a.ts" }] };
    const result = attributeInPlace(diff, ["src/"], [
      { id: "wild", paths: [], concurrent: true },
    ]);
    expect(result.enforceable).toBe(false);
  });
});

describe("metrics", () => {
  let directory: string;
  let db: Database;
  let store: SquadStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-metrics-"));
    db = openSquadDb(directory);
    store = new SquadStore(db);
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("computes pass@1, rework, failures and cost per integrated task", () => {
    const mission = store.createMission("metrics", "", "none");
    store.submitPlan(mission.id, {
      goal: "metrics",
      expectedCostUsd: 1,
      tasks: ["a", "b", "c"].map((id) => ({
        id,
        title: id,
        class: "code" as const,
        role: "implementer",
        grade: "G1" as const,
        acceptance: ["ok"],
      })),
    });
    db.query("UPDATE tasks SET status = 'integrated', attempts = 0 WHERE id = 'a'").run();
    db.query("UPDATE tasks SET status = 'integrated', attempts = 1 WHERE id = 'b'").run();
    db.query("UPDATE tasks SET status = 'failed' WHERE id = 'c'").run();
    store.recordLedger({ missionID: mission.id, taskID: "a", cost: 0.3 });

    const metrics = store.metrics(mission.id);
    expect(metrics.tasks.total).toBe(3);
    expect(metrics.passAt1).toBeCloseTo(0.5, 5);
    expect(metrics.reworkRate).toBeCloseTo(1 / 3, 5);
    expect(metrics.tasks.failed).toBe(1);
    expect(metrics.costUsd).toBeCloseTo(0.3, 5);
    expect(metrics.costPerIntegratedTaskUsd).toBeCloseTo(0.15, 5);
    expect(metrics.durationMinutes).not.toBeNull();
  });
});

describe("worktree probe", () => {
  beforeEach(() => {
    resetWorktreeProbeCache();
  });

  test("reports ok when the host can create and remove a worktree", async () => {
    const removed: string[] = [];
    const ctx = {
      location: { project: { id: "p" }, directory: "C:/repo" },
      worktree: {
        create: async ({ name }: { name: string }) => ({ directory: `C:/wt/${name}` }),
        remove: async ({ directory }: { directory: string }) => {
          removed.push(directory);
        },
      },
    };
    const result = await probeWorktree(ctx as never);
    expect(result.ok).toBe(true);
    expect(removed).toHaveLength(1);
  });

  test("reports the host error instead of throwing", async () => {
    const ctx = {
      location: { project: { id: "p" }, directory: "C:/repo" },
      worktree: {
        create: async () => {
          throw new Error("Unable to create worktree probe");
        },
        remove: async () => undefined,
      },
    };
    const result = await probeWorktree(ctx as never);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unable to create worktree");
  });
});

describe("task paths", () => {
  let directory: string;
  let db: Database;
  let store: SquadStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-paths-"));
    db = openSquadDb(directory);
    store = new SquadStore(db);
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("a plan keeps per-task paths through submit and read", () => {
    const mission = store.createMission("paths", "", "none");
    store.submitPlan(mission.id, {
      goal: "paths",
      tasks: [
        {
          id: "t1",
          title: "docs",
          class: "writing",
          role: "writer",
          grade: "G1",
          acceptance: ["ok"],
          paths: ["docs/", "README.md"],
        },
      ],
    });
    expect(store.requireTask(mission.id, "t1").paths).toEqual(["docs/", "README.md"]);
  });
});
