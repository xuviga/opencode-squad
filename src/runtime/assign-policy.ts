export type TaskConstraints = Record<string, unknown> & {
  tool_call_budget: number;
  budget_policy: string;
  research_policy?: string;
};

/** Tool-call budget per task class: research is capped harder. */
export function toolBudgetFor(taskClass: string): number {
  return taskClass === "research" ? 10 : 20;
}

export function taskConstraints(
  taskClass: string,
  extra: Record<string, unknown> = {},
): TaskConstraints {
  return {
    tool_call_budget: toolBudgetFor(taskClass),
    budget_policy:
      "When the budget is exhausted, stop and return status=blocked with the evidence gathered so far.",
    ...(taskClass === "research"
      ? {
          research_policy:
            "Batch independent fetches into one execute call; use at most one websearch, then fetch only gaps. Do not run dozens of sequential exploration calls.",
        }
      : {}),
    ...extra,
  };
}
