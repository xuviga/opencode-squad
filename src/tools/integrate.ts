import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { integrateWorktree } from "../runtime/integrate";
import { removeWorktree } from "../runtime/worktree";
import { fail, ok } from "./result";

type IntegrateInput = {
  mission_id?: string;
  task_id?: string;
  strategy?: "abort" | "theirs";
};

export async function registerIntegrateTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "integrate",
      description:
        "Merge integrated worktree commits into the main checkout via cherry-pick. Refuses dirty main; records integration.merged per task. strategy=abort stops on conflict, strategy=theirs auto-resolves content conflicts for the worker side.",
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
          task_id: { type: "string" },
          strategy: { type: "string", enum: ["abort", "theirs"] },
        },
        required: ["mission_id"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as IntegrateInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_integrate",
            resources: [args.task_id ?? args.mission_id],
          });

          const tasks = args.task_id
            ? [store.requireTask(args.mission_id, args.task_id)]
            : store
                .listTasks(args.mission_id)
                .filter((task) => task.status === "integrated" && !task.mergedAt);

          if (tasks.length === 0) {
            return ok({ integrated: 0, message: "no unmerged integrated tasks" });
          }

          const results = [];
          for (const task of tasks) {
            if (task.status !== "integrated") {
              throw new Error(`cannot integrate task in status ${task.status}: ${task.id}`);
            }
            const staff = task.staffID ? store.getStaff(task.staffID) : undefined;
            if (!staff?.worktreeDirectory) {
              const mission = store.requireMission(args.mission_id);
              if (mission.isolation === "none") {
                const merged = store.markMergedInPlace(args.mission_id, task.id);
                results.push({ taskID: task.id, inPlace: true, task: merged });
                continue;
              }
              results.push({ taskID: task.id, skipped: true, reason: "no worktree" });
              continue;
            }

            const integration = integrateWorktree(
              ctx.location.directory,
              staff.worktreeDirectory,
              { strategy: args.strategy ?? "abort" },
            );
            const merged = store.markMerged(
              args.mission_id,
              task.id,
              integration.commit,
              integration.sourceCommit,
            );

            // The worktree is no longer needed: the commit is in main and the
            // audit reads the diff from the integration commit. A dirty
            // worktree is left in place and reported instead of force-deleted.
            let worktreeRemoval:
              | { directory: string; removed: boolean; error?: string }
              | undefined;
            if (staff.worktreeDirectory) {
              worktreeRemoval = await removeWorktree(ctx, staff.worktreeDirectory);
              if (worktreeRemoval.removed) {
                store.clearWorktree(staff.id);
                store.addEvent(args.mission_id, task.id, "worktree.removed", {
                  directory: staff.worktreeDirectory,
                });
              } else {
                store.addEvent(args.mission_id, task.id, "worktree.remove_failed", {
                  directory: staff.worktreeDirectory,
                  error: worktreeRemoval.error ?? "unknown",
                });
              }
            }

            results.push({
              taskID: task.id,
              commit: integration.commit,
              sourceCommit: integration.sourceCommit,
              alreadyMerged: integration.alreadyMerged,
              strategy: integration.strategy,
              worktreeRemoved: worktreeRemoval?.removed ?? false,
              worktreeError: worktreeRemoval?.error,
              task: merged,
            });
          }

          return ok({
            integrated: results.filter((result) => !("skipped" in result)).length,
            results,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
