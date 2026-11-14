import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPlanTemplate, CLASS_TEMPLATES, listTemplates } from "../src/classes";
import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";
import { resolvePersona } from "../src/personas";
import { TASK_CLASSES } from "../src/plan";

describe("class templates", () => {
  test("cover every task class", () => {
    const templates = listTemplates();
    const covered = new Set(templates.map((template) => template.class));
    for (const taskClass of TASK_CLASSES) {
      expect(covered.has(taskClass)).toBe(true);
    }
    expect(Object.keys(CLASS_TEMPLATES)).toHaveLength(TASK_CLASSES.length - 1);
  });

  test("every template builds a valid plan with known roles", () => {
    for (const taskClass of TASK_CLASSES) {
      const plan = buildPlanTemplate({
        class: taskClass,
        goal: `Deliver a ${taskClass} outcome`,
      });
      expect(plan.tasks.length).toBeGreaterThan(0);
      const ids = new Set(plan.tasks.map((task) => task.id));
      for (const task of plan.tasks) {
        expect(task.class).toBe(taskClass);
        expect(task.acceptance.length).toBeGreaterThan(0);
        expect(() => resolvePersona(task.role)).not.toThrow();
        for (const dependency of task.dependsOn ?? []) {
          expect(ids.has(dependency)).toBe(true);
        }
        for (const capability of task.capabilities ?? []) {
          expect(capability.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("prefix and capabilities are applied to every step", () => {
    const plan = buildPlanTemplate({
      class: "design",
      goal: "Poster",
      prefix: "Poster 2026",
      capabilities: ["skill:coreldraw"],
    });
    expect(plan.tasks.map((task) => task.id)).toEqual([
      "poster-2026_concept",
      "poster-2026_produce",
    ]);
    for (const task of plan.tasks) {
      expect(task.capabilities).toContain("skill:coreldraw");
    }
    expect(plan.tasks[1]?.dependsOn).toEqual(["poster-2026_concept"]);
  });

  test("mixed builds a single generic task", () => {
    const plan = buildPlanTemplate({ class: "mixed", goal: "Do the thing", prefix: "x" });
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0]?.id).toBe("x_deliver");
  });
});

describe("task capabilities persistence", () => {
  let directory: string;
  let db: Database;
  let store: SquadStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-caps-"));
    db = openSquadDb(directory);
    store = new SquadStore(db);
  });

  afterEach(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  test("submitPlan stores capabilities on the task", () => {
    const mission = store.createMission("Caps", "Store capabilities");
    store.submitPlan(mission.id, {
      goal: "Store capabilities",
      tasks: [
        {
          id: "t_caps",
          title: "Use a skill",
          class: "research",
          role: "researcher",
          grade: "G1",
          acceptance: ["done"],
          capabilities: ["skill:coreldraw", "mcp:poster-compiler"],
        },
      ],
    });

    const task = store.requireTask(mission.id, "t_caps");
    expect(task.capabilities).toEqual(["skill:coreldraw", "mcp:poster-compiler"]);
  });

  test("tasks without capabilities default to an empty array", () => {
    const mission = store.createMission("No caps", "Store nothing");
    store.submitPlan(mission.id, {
      goal: "Store nothing",
      tasks: [
        {
          id: "t_plain",
          title: "Plain",
          class: "code",
          role: "implementer",
          grade: "G2",
          acceptance: ["done"],
        },
      ],
    });

    expect(store.requireTask(mission.id, "t_plain").capabilities).toEqual([]);
  });
});
