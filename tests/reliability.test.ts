import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG, loadSquadConfig } from "../src/config";
import { acquireSquadDb, closeSharedHandles, openSquadDb, sharedHandleCount } from "../src/db/index";
import { SquadStore } from "../src/db/store";
import { scanStale } from "../src/runtime/janitor";
import {
  attributeInPlace,
  overlappingPatterns,
  pathMatches,
  partitionDiff,
  patternsOverlap,
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

describe("blocked reports", () => {
  let directory: string;
  let db: Database;
  let store: SquadStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-blocked-"));
    db = openSquadDb(directory);
    store = new SquadStore(db);
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("a blocked task keeps its attempts and can be reassigned", () => {
    const mission = store.createMission("blocked", "", "none");
    store.submitPlan(mission.id, {
      goal: "blocked",
      tasks: [
        {
          id: "t1",
          title: "blocked work",
          class: "code",
          role: "implementer",
          grade: "G1",
          acceptance: ["ok"],
        },
      ],
    });
    store.approvePlan(mission.id);
    const staff = store.hireStaff({
      persona: "implementer",
      grade: "G1",
      agent: "build",
      provider: "deepseek",
      model: "deepseek-flash",
      variant: "low",
      sessionID: "ses_blocked",
    });
    store.assignTask(mission.id, "t1", staff.id, { goal: "x" });
    store.markTaskRunning(mission.id, "t1");

    const blocked = store.blockTask(mission.id, "t1", "missing credentials");
    expect(blocked.status).toBe("blocked");
    expect(blocked.attempts).toBe(0);
    expect(() => store.assignReview(mission.id, "t1", staff.id, "ses_reviewer")).toThrow(
      "cannot review task in status blocked",
    );

    const reassigned = store.assignTask(mission.id, "t1", staff.id, { goal: "y" });
    expect(reassigned.status).toBe("assigned");
    expect(reassigned.attempts).toBe(0);
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

describe("config file", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-config-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function writeConfig(value: unknown) {
    mkdirSync(join(directory, ".squad"), { recursive: true });
    writeFileSync(join(directory, ".squad", "config.json"), JSON.stringify(value), "utf8");
  }

  test("missing file keeps the defaults", () => {
    expect(loadSquadConfig(directory)).toEqual(DEFAULT_CONFIG);
  });

  test("partial file merges over defaults and keeps unset grades", () => {
    writeConfig({ maxRework: 1, hardLimitUsd: 0.5, grades: { G2: { providerID: "x", modelID: "y", variant: "z" } } });
    const config = loadSquadConfig(directory);
    expect(config.maxRework).toBe(1);
    expect(config.hardLimitUsd).toBe(0.5);
    expect(config.grades.G2).toEqual({ providerID: "x", modelID: "y", variant: "z" });
    expect(config.grades.G4).toEqual(DEFAULT_CONFIG.grades.G4);
    expect(config.gcIntervalMinutes).toBe(DEFAULT_CONFIG.gcIntervalMinutes);
  });

  test("a typo fails loudly instead of silently using defaults", () => {
    mkdirSync(join(directory, ".squad"), { recursive: true });
    writeFileSync(join(directory, ".squad", "config.json"), "{ not json", "utf8");
    expect(() => loadSquadConfig(directory)).toThrow("cannot parse");
    writeConfig({ softWarnPct: [90, 70] });
    expect(() => loadSquadConfig(directory)).toThrow("ascending");
  });
});

describe("write locks", () => {
  let directory: string;
  let db: Database;
  let store: SquadStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-locks-"));
    db = openSquadDb(directory);
    store = new SquadStore(db);
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("overlap detection covers prefixes, globs and exact paths", () => {
    expect(patternsOverlap("docs/", "docs/a.md")).toBe(true);
    expect(patternsOverlap("docs/", "src/")).toBe(false);
    expect(patternsOverlap("src/**/*.ts", "src/a/b.ts")).toBe(true);
    expect(patternsOverlap("src/**/*.ts", "docs/a.md")).toBe(false);
    expect(overlappingPatterns(["docs/"], ["docs/a.md", "README.md"])).toHaveLength(1);
  });

  test("assign refuses an overlapping writer and allows a disjoint one", () => {
    const mission = store.createMission("locks", "", "none");
    store.submitPlan(mission.id, {
      goal: "locks",
      tasks: [
        { id: "a", title: "a", class: "writing", role: "writer", grade: "G1", acceptance: ["ok"], paths: ["docs/"] },
        { id: "b", title: "b", class: "writing", role: "writer", grade: "G1", acceptance: ["ok"], paths: ["docs/deep.md"] },
        { id: "c", title: "c", class: "writing", role: "writer", grade: "G1", acceptance: ["ok"], paths: ["src/"] },
      ],
    });
    store.approvePlan(mission.id);
    const staff = store.hireStaff({
      persona: "writer",
      grade: "G1",
      agent: "build",
      provider: "deepseek",
      model: "deepseek-flash",
      variant: "low",
      sessionID: "ses_lock",
    });

    store.assignTask(mission.id, "a", staff.id, { goal: "a" });
    expect(() => store.assignTask(mission.id, "b", staff.id, { goal: "b" })).toThrow(
      "path lock conflict with task a",
    );
    expect(() => store.assignTask(mission.id, "c", staff.id, { goal: "c" })).not.toThrow();
    expect(store.listLocks(mission.id).map((lock) => lock.taskID).sort()).toEqual(["a", "c"]);
  });
});

describe("janitor", () => {
  let directory: string;
  let db: Database;
  let store: SquadStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-janitor-"));
    db = openSquadDb(directory);
    store = new SquadStore(db);
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("scan reports a mission that has been idle past the window", () => {
    const mission = store.createMission("stale", "", "none");
    const old = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    db.query("UPDATE missions SET created_at = ?, updated_at = ? WHERE id = ?").run(
      old,
      old,
      mission.id,
    );

    const report = scanStale(store, 120);
    expect(report.stale.map((row) => row.id)).toEqual([mission.id]);
    expect(report.stale[0]!.idleMinutes).toBeGreaterThan(200);
    expect(report.aborted).toEqual([]);
  });

  test("a fresh mission is not reported", () => {
    store.createMission("fresh", "", "none");
    expect(scanStale(store, 120).stale).toEqual([]);
  });
});
