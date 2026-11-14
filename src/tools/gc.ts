import type { Plugin } from "@opencode/plugin";
import { DEFAULT_CONFIG } from "../config";
import type { Mission, Task } from "../db/model";
import type { SquadStore } from "../db/store";
import { planWorktreeSweep } from "../runtime/gc";
import { removeWorktree } from "../runtime/worktree";
import { fail, ok } from "./result";

type GcInput = {
  action?: "scan" | "apply";
  stale_minutes?: number;
  force?: boolean;
};

export async function registerGcTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "gc",
      description:
        "Janitor for SQUAD state. scan: report stale non-terminal missions and orphaned worker worktrees. apply: abort stale missions and remove those worktrees (force=false refuses dirty worktrees).",
      input: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["scan", "apply"] },
          stale_minutes: { type: "number" },
          force: { type: "boolean" },
        },
        required: ["action"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as GcInput;
        try {
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_gc",
            resources: [args.action ?? "scan"],
          });

          const staleMinutes = Math.max(
            1,
            Math.trunc(args.stale_minutes ?? DEFAULT_CONFIG.staleAfterMinutes),
          );
          const staleMissions = store.listStaleMissions(staleMinutes);
          const staff = store.listStaffWithWorktrees();

          const tasksByStaff = new Map<string, Task[]>();
          const missions = new Map<string, Mission>();
          for (const employee of staff) {
            const tasks = store.listTasksByStaff(employee.id);
            tasksByStaff.set(employee.id, tasks);
            for (const task of tasks) {
              if (missions.has(task.missionID)) continue;
              const mission = store.getMission(task.missionID);
              if (mission) missions.set(mission.id, mission);
            }
          }

          const plan = planWorktreeSweep({
            staff,
            tasksByStaff,
            missions,
            staleMissionIDs: new Set(staleMissions.map((mission) => mission.id)),
          });

          const scan = {
            staleAfterMinutes: staleMinutes,
            stale_missions: staleMissions.map((mission) => ({
              id: mission.id,
              title: mission.title,
              status: mission.status,
              updatedAt: mission.updatedAt,
              idleMinutes: Math.round((Date.now() - Date.parse(mission.updatedAt)) / 60_000),
            })),
            worktrees: plan,
            totals: { staleMissions: staleMissions.length, worktrees: plan.length },
          };

          if (args.action !== "apply") return ok(scan);

          const aborted: Array<{ missionID: string; status?: string; error?: string }> = [];
          for (const mission of staleMissions) {
            try {
              const next = store.abortMission(
                mission.id,
                `stale: no activity since ${mission.updatedAt}`,
              );
              aborted.push({ missionID: mission.id, status: next.status });
            } catch (error) {
              aborted.push({
                missionID: mission.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          const removed: Array<{ directory: string; removed: boolean; error?: string }> = [];
          for (const candidate of plan) {
            const removal = await removeWorktree(ctx, candidate.directory, {
              force: args.force ?? false,
            });
            if (removal.removed) store.clearWorktree(candidate.staffID);
            removed.push(removal);
          }

          return ok({ ...scan, applied: { aborted, removed } });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
