import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type FireInput = {
  staff_id?: string;
  reason?: string;
  evidence_ref?: string;
};

export async function registerFireTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "fire",
      description:
        "Fire a SQUAD employee. Requires a reason and an evidence reference; blacklists persona+grade for 30 days and removes the staff session.",
      input: {
        type: "object",
        properties: {
          staff_id: { type: "string" },
          reason: { type: "string" },
          evidence_ref: { type: "string" },
        },
        required: ["staff_id", "reason", "evidence_ref"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as FireInput;
        try {
          if (!args.staff_id) throw new Error("staff_id is required");
          if (!args.reason) throw new Error("reason is required");
          if (!args.evidence_ref) throw new Error("evidence_ref is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_fire",
            resources: [args.staff_id],
          });

          const staff = store.fireStaff(args.staff_id, args.reason, args.evidence_ref);
          if (staff.sessionID) {
            await ctx.session.remove({ sessionID: staff.sessionID }).catch(() => undefined);
          }
          return ok({
            staff,
            blacklisted: store.isBlacklisted(staff.persona, staff.grade),
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
