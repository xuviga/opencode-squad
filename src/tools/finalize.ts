import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type FinalizeInput = {
  mission_id?: string;
};

export async function registerFinalizeTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "finalize",
      description:
        "Global integration gate: finalize a mission in integrating status only when every task is integrated.",
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
        },
        required: ["mission_id"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as FinalizeInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_finalize",
            resources: [args.mission_id],
          });
          const mission = store.finalizeMission(args.mission_id);
          return ok({ mission });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
