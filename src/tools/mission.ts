import type { Plugin } from "@opencode/plugin";
import type { Isolation } from "../db/model";
import type { SquadStore } from "../db/store";
import { isGitRepository } from "../runtime/git";
import { probeWorktree } from "../runtime/worktree";
import { fail, ok } from "./result";

type MissionInput = {
  action?: "create" | "list" | "get";
  mission_id?: string;
  title?: string;
  goal?: string;
  isolation?: Isolation;
};

export async function registerMissionTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "mission",
      description:
        "Create, list, or inspect SQUAD missions. A new mission starts in status draft; a submitted plan moves it to plan_gate. isolation=worktree (default) requires a git repository; isolation=none runs employees directly in the project directory and reviews filesystem snapshots instead of git diffs.",
      input: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "list", "get"] },
          mission_id: { type: "string" },
          title: { type: "string" },
          goal: { type: "string" },
          isolation: { type: "string", enum: ["worktree", "none"] },
        },
        required: ["action"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = input as MissionInput;
        try {
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_mission",
            resources: [args.mission_id ?? args.action ?? "*"],
          });
          switch (args.action) {
            case "create": {
              if (!args.title) throw new Error("title is required for create");
              const isolation: Isolation = args.isolation === "none" ? "none" : "worktree";
              if (isolation === "worktree" && !isGitRepository(ctx.location.directory)) {
                throw new Error(
                  `Worktree isolation needs a git repository, but ${ctx.location.directory} is not one. ` +
                    `Either create the repository before opening OpenCode (git init && git add -A && git commit -m baseline), ` +
                    `or create this mission with isolation:"none" to run employees directly in the folder ` +
                    `(weaker isolation: no worktrees, reviews use filesystem snapshots).`,
                );
              }
              let probe: Awaited<ReturnType<typeof probeWorktree>> | undefined;
              if (isolation === "worktree") {
                probe = await probeWorktree(ctx);
                if (!probe.ok) {
                  throw new Error(
                    `The host cannot create a git worktree for this project (${probe.error ?? "unknown error"}). ` +
                      `The folder is a git repository, so this is a host capability failure: a stale worktree ` +
                      `registry entry or a disposed session can cause it. Check the host worktree list, or start ` +
                      `this mission with isolation:"none" (employees write in the folder, reviews use snapshots).`,
                  );
                }
              }
              const mission = store.createMission(args.title, args.goal ?? "", isolation);
              return ok({
                mission,
                mission_id: mission.id,
                isolation: mission.isolation,
                ...(probe?.ok ? { worktree_probe: probe.directory } : {}),
              });
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
