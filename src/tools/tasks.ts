import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type TasksInput = {
  mission_id?: string;
  status?: string;
};

export async function registerTasksTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "tasks",
      description: "List SQUAD mission tasks, optionally filtered by status; shows DAG dependencies and readiness.",
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
          status: { type: "string" },
        },
        required: ["mission_id"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as TasksInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_tasks",
            resources: [args.mission_id],
          });
          const tasks = store
            .listTasks(args.mission_id)
            .filter((task) => (args.status ? task.status === args.status : true));
          return ok({
            mission_id: args.mission_id,
            count: tasks.length,
            tasks,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
