import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type StaffInput = {
  action?: "list" | "get";
  staff_id?: string;
  limit?: number;
};

export async function registerStaffTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "staff",
      description: "List or inspect SQUAD staff records (persona, grade, agent, session, score, status).",
      input: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "get"] },
          staff_id: { type: "string" },
          limit: { type: "number" },
        },
        required: ["action"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input) => {
        const args = (input ?? {}) as StaffInput;
        try {
          if (args.action === "get") {
            if (!args.staff_id) throw new Error("staff_id is required for get");
            return ok({ staff: store.requireStaff(args.staff_id) });
          }
          return ok({ staff: store.listStaff(args.limit ?? 50) });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
