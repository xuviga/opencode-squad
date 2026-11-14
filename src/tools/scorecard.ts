import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type ScorecardInput = {
  staff_id?: string;
};

export async function registerScorecardTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "scorecard",
      description:
        "Compute a SQUAD scorecard: pass@1, rework, timeout, cost efficiency, weighted score, and a career recommendation.",
      input: {
        type: "object",
        properties: {
          staff_id: { type: "string" },
        },
        required: ["staff_id"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as ScorecardInput;
        try {
          if (!args.staff_id) throw new Error("staff_id is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_scorecard",
            resources: [args.staff_id],
          });

          return ok({
            scorecard: store.scorecard(args.staff_id),
            appraisals: store.listAppraisals(args.staff_id, 20),
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
