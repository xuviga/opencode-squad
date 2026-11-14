import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type CareerInput = {
  staff_id?: string;
  action?: "evaluate" | "promote" | "demote";
};

export async function registerCareerTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "career",
      description:
        "Evaluate a SQUAD scorecard and apply a promotion/demotion, or force a grade change. Firing always requires squad_fire with evidence.",
      input: {
        type: "object",
        properties: {
          staff_id: { type: "string" },
          action: { type: "string", enum: ["evaluate", "promote", "demote"] },
        },
        required: ["staff_id", "action"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as CareerInput;
        try {
          if (!args.staff_id) throw new Error("staff_id is required");
          if (!args.action) throw new Error("action is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_career",
            resources: [args.staff_id],
          });

          const scorecard = store.scorecard(args.staff_id);
          if (args.action === "promote") {
            return ok({ scorecard, staff: store.changeGrade(args.staff_id, "up") });
          }
          if (args.action === "demote") {
            return ok({ scorecard, staff: store.changeGrade(args.staff_id, "down") });
          }

          if (scorecard.recommendation === "promote") {
            return ok({
              scorecard,
              staff: store.changeGrade(args.staff_id, "up"),
              applied: "promote",
            });
          }
          if (scorecard.recommendation === "demote") {
            return ok({
              scorecard,
              staff: store.changeGrade(args.staff_id, "down"),
              applied: "demote",
            });
          }
          return ok({
            scorecard,
            staff: store.requireStaff(args.staff_id),
            applied: "none",
            note:
              scorecard.recommendation === "fire"
                ? "scorecard recommends fire; use squad_fire with evidence"
                : "no career change",
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
