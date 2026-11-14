import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { hireEmployee } from "../runtime/hire";
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
          if (!["staffing", "executing", "reviewing"].includes(mission.status)) {
            throw new Error(`cannot hire in mission status ${mission.status}`);
          }

          const result = await hireEmployee(ctx, store, {
            missionID: args.mission_id,
            persona: args.persona,
            grade: args.grade,
            agent: args.agent,
            parentSessionID: context.sessionID,
          });

          return ok({
            staff: result.staff,
            staff_id: result.staff.id,
            session_id: result.sessionID,
            agent: result.agent,
            grade: result.grade,
            model: result.model,
            access: result.access,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
