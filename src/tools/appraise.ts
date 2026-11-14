import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type AppraiseInput = {
  staff_id?: string;
  delta?: number;
  note?: string;
};

export async function registerAppraiseTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "appraise",
      description:
        "Praise or criticize a SQUAD employee: adjust score in [0,1], record the appraisal and note.",
      input: {
        type: "object",
        properties: {
          staff_id: { type: "string" },
          delta: { type: "number" },
          note: { type: "string" },
        },
        required: ["staff_id", "delta"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as AppraiseInput;
        try {
          if (!args.staff_id) throw new Error("staff_id is required");
          if (typeof args.delta !== "number") throw new Error("delta must be a number");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_appraise",
            resources: [args.staff_id],
          });

          const staff = store.appraiseStaff(args.staff_id, args.delta, args.note ?? "");
          return ok({
            staff,
            appraisals: store.listAppraisals(args.staff_id, 20),
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
