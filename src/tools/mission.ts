import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type MissionInput = {
  action?: "create" | "list" | "get";
  mission_id?: string;
  title?: string;
  goal?: string;
};

export async function registerMissionTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "mission",
      description:
        "Create, list, or inspect SQUAD missions. A new mission starts in status draft; a submitted plan moves it to plan_gate.",
      input: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "list", "get"] },
          mission_id: { type: "string" },
          title: { type: "string" },
          goal: { type: "string" },
        },
        required: ["action"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input) => {
        const args = input as MissionInput;
        try {
          switch (args.action) {
            case "create": {
              if (!args.title) throw new Error("title is required for create");
              const mission = store.createMission(args.title, args.goal ?? "");
              return ok({ mission, mission_id: mission.id });
            }
            case "list":
              return ok({ missions: store.listMissions() });
            case "get": {
              if (!args.mission_id) throw new Error("mission_id is required for get");
              const mission = store.requireMission(args.mission_id);
              return ok({ mission, plan: store.getPlan(args.mission_id) });
            }
            default:
              throw new Error(`unknown action: ${String(args.action)}`);
          }
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
