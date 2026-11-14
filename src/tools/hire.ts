import type { Plugin } from "@opencode/plugin";
import { DEFAULT_CONFIG } from "../config";
import type { SquadStore } from "../db/store";
import { gradeOrDefault, personaPermissions, resolvePersona } from "../personas";
import { fail, ok } from "./result";

type HireInput = {
  mission_id?: string;
  persona?: string;
  grade?: string;
  agent?: string;
};

export async function registerHireTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "hire",
      description:
        "Hire a SQUAD employee: create a child session with the persona's agent, grade model, and permissions, and persist the staff record.",
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
          persona: { type: "string" },
          grade: { type: "string", enum: ["G0", "G1", "G2", "G3", "G4"] },
          agent: { type: "string" },
        },
        required: ["mission_id", "persona"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as HireInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          if (!args.persona) throw new Error("persona is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_hire",
            resources: [args.persona],
          });

          const mission = store.requireMission(args.mission_id);
          if (!["staffing", "executing"].includes(mission.status)) {
            throw new Error(`cannot hire in mission status ${mission.status}`);
          }

          const spec = resolvePersona(args.persona);
          const grade = gradeOrDefault(args.persona, args.grade);
          const model = DEFAULT_CONFIG.grades[grade];
          const agent = args.agent?.trim() || spec.agent;

          const session = await ctx.session.create({
            parentID: context.sessionID,
            title: `SQUAD ${args.persona} (${grade})`,
            agent,
            model: {
              id: model.modelID,
              providerID: model.providerID,
              variant: model.variant,
            },
            location: { directory: ctx.location.directory },
            permissions: personaPermissions(spec.access),
          });

          try {
            const staff = store.hireStaff({
              persona: args.persona,
              grade,
              agent,
              provider: model.providerID,
              model: model.modelID,
              variant: model.variant,
              sessionID: session.id,
            });
            return ok({
              staff,
              staff_id: staff.id,
              session_id: session.id,
              agent,
              grade,
              model,
              access: spec.access,
            });
          } catch (error) {
            await ctx.session.remove({ sessionID: session.id }).catch(() => undefined);
            throw error;
          }
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
