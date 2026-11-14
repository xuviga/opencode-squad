import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type BudgetInput = {
  mission_id?: string;
};

export async function registerBudgetTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "budget",
      description:
        "Report SQUAD budget: expected vs actual cost for one mission or for all missions, from the per-session ledger.",
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
        },
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input) => {
        const args = (input ?? {}) as BudgetInput;
        try {
          return ok(store.budgetSummary(args.mission_id));
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
