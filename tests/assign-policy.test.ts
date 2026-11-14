import { describe, expect, test } from "bun:test";
import { taskConstraints, toolBudgetFor } from "../src/runtime/assign-policy";

describe("task constraints", () => {
  test("research tasks get a hard 10-call budget", () => {
    expect(toolBudgetFor("research")).toBe(10);
    const constraints = taskConstraints("research");
    expect(constraints.tool_call_budget).toBe(10);
    expect(constraints.research_policy).toContain("Batch independent fetches");
  });

  test("code tasks get 20 calls and no research policy", () => {
    const constraints = taskConstraints("code");
    expect(constraints.tool_call_budget).toBe(20);
    expect(constraints.research_policy).toBeUndefined();
  });

  test("caller overrides win over defaults", () => {
    const constraints = taskConstraints("research", { tool_call_budget: 4, custom: "x" });
    expect(constraints.tool_call_budget).toBe(4);
    expect(constraints.custom).toBe("x");
  });
});
