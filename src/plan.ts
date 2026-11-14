export const TASK_CLASSES = [
  "code",
  "research",
  "writing",
  "design",
  "data",
  "ops",
  "review",
  "planning",
  "creative",
  "mixed",
] as const;

export type TaskClass = (typeof TASK_CLASSES)[number];

export const GRADES = ["G0", "G1", "G2", "G3", "G4"] as const;
export type PlanGrade = (typeof GRADES)[number];

export type PlanTask = {
  id: string;
  title: string;
  class: TaskClass;
  role: string;
  grade: PlanGrade;
  acceptance: string[];
  dependsOn?: string[];
};

export type MissionPlan = {
  goal: string;
  tasks: PlanTask[];
  expectedCostUsd?: number;
  notes?: string;
};

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

export function validatePlan(value: unknown): MissionPlan {
  const plan = asRecord(value, "plan");
  const goal = asString(plan.goal, "plan.goal");
  if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    throw new Error("plan.tasks must be a non-empty array");
  }

  const ids = new Set<string>();
  const tasks: PlanTask[] = plan.tasks.map((raw, index) => {
    const task = asRecord(raw, `plan.tasks[${index}]`);
    const id = asString(task.id, `plan.tasks[${index}].id`);
    if (ids.has(id)) throw new Error(`duplicate task id: ${id}`);
    ids.add(id);

    const taskClass = asString(task.class, `plan.tasks[${index}].class`);
    if (!(TASK_CLASSES as readonly string[]).includes(taskClass)) {
      throw new Error(`unknown task class: ${taskClass}`);
    }

    const grade = asString(task.grade, `plan.tasks[${index}].grade`);
    if (!(GRADES as readonly string[]).includes(grade)) {
      throw new Error(`unknown grade: ${grade}`);
    }

    const acceptance = Array.isArray(task.acceptance)
      ? task.acceptance.map((item, acceptanceIndex) =>
          asString(item, `plan.tasks[${index}].acceptance[${acceptanceIndex}]`),
        )
      : [];
    if (acceptance.length === 0) {
      throw new Error(`plan.tasks[${index}].acceptance must not be empty`);
    }

    const dependsOn = Array.isArray(task.dependsOn)
      ? task.dependsOn.map((item, dependencyIndex) =>
          asString(item, `plan.tasks[${index}].dependsOn[${dependencyIndex}]`),
        )
      : undefined;

    return {
      id,
      title: asString(task.title, `plan.tasks[${index}].title`),
      class: taskClass as TaskClass,
      role: asString(task.role, `plan.tasks[${index}].role`),
      grade: grade as PlanGrade,
      acceptance,
      dependsOn,
    };
  });

  for (const task of tasks) {
    for (const dependency of task.dependsOn ?? []) {
      if (!ids.has(dependency)) {
        throw new Error(`task ${task.id} depends on unknown task ${dependency}`);
      }
    }
  }

  const expectedCostUsd =
    plan.expectedCostUsd === undefined ? undefined : Number(plan.expectedCostUsd);
  if (expectedCostUsd !== undefined && (!Number.isFinite(expectedCostUsd) || expectedCostUsd < 0)) {
    throw new Error("plan.expectedCostUsd must be a non-negative number");
  }

  const notes = plan.notes === undefined ? undefined : String(plan.notes);

  return { goal, tasks, expectedCostUsd, notes };
}
