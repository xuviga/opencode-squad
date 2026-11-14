import { describe, expect, test } from "bun:test";
import { validatePlan } from "../src/plan";

const validPlan = {
  goal: "Ship a fix",
  tasks: [
    {
      id: "t_001",
      title: "Fix pagination",
      class: "code",
      role: "implementer",
      grade: "G2",
      acceptance: ["page 2 works"],
    },
  ],
};

describe("validatePlan", () => {
  test("accepts a valid plan", () => {
    const plan = validatePlan(validPlan);
    expect(plan.goal).toBe("Ship a fix");
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0]?.acceptance).toEqual(["page 2 works"]);
  });

  test("rejects duplicate task ids", () => {
    expect(() =>
      validatePlan({
        ...validPlan,
        tasks: [validPlan.tasks[0], validPlan.tasks[0]],
      }),
    ).toThrow("duplicate task id");
  });

  test("rejects an unknown class", () => {
    expect(() =>
      validatePlan({
        ...validPlan,
        tasks: [{ ...validPlan.tasks[0], class: "magic" }],
      }),
    ).toThrow("unknown task class");
  });

  test("rejects an unknown grade", () => {
    expect(() =>
      validatePlan({
        ...validPlan,
        tasks: [{ ...validPlan.tasks[0], grade: "G9" }],
      }),
    ).toThrow("unknown grade");
  });

  test("rejects empty acceptance", () => {
    expect(() =>
      validatePlan({
        ...validPlan,
        tasks: [{ ...validPlan.tasks[0], acceptance: [] }],
      }),
    ).toThrow("acceptance must not be empty");
  });

  test("rejects an unknown dependency", () => {
    expect(() =>
      validatePlan({
        ...validPlan,
        tasks: [{ ...validPlan.tasks[0], dependsOn: ["t_999"] }],
      }),
    ).toThrow("depends on unknown task");
  });
});
