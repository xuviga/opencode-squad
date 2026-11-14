import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type CancelInput = {
  mission_id?: string;
  reason?: string;
};

export async function registerCancelTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "cancel",
      description:
        "Abort a SQUAD mission with a recorded reason. Cancels every non-integrated task, keeps merged work, and releases the mission from executing/reviewing/integrating.",
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["mission_id", "reason"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as CancelInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          if (!args.reason) throw new Error("reason is required");
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_cancel",
            resources: [args.mission_id],
          });
          const mission = store.abortMission(args.mission_id, args.reason);
          return ok({ mission, tasks: store.listTasks(args.mission_id) });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
