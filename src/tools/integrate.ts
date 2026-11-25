import type { Plugin } from "@opencode/plugin";
import type { SquadStore, Task } from "../db/store";
import { gitHead, gitResetHard } from "../runtime/git";
import { integrateWorktree, type IntegrationResult } from "../runtime/integrate";
import { removeWorktree, type WorktreeRemoval } from "../runtime/worktree";
import { fail, ok } from "./result";

type IntegrateInput = {
  mission_id?: string;
  task_id?: string;
  strategy?: "abort" | "theirs";
};

type PendingMerge = {
  task: Task;
  integration: IntegrationResult;
};

export async function registerIntegrateTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "integrate",
      description:
        "Merge integrated worktree commits into the main checkout via cherry-pick. Refuses dirty main; records integration.merged per task. strategy=abort stops on conflict, strategy=theirs auto-resolves content conflicts for the worker side. A batch is all-or-nothing: if a later cherry-pick fails, the cherry-picks made in this call are rolled back and their tasks are unmarked.",
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

          const mission = store.requireMission(args.mission_id);
          const strategy = args.strategy ?? "abort";
          // Baseline of this batch: a failed later cherry-pick rewinds main here,
          // so a partially merged mission never looks complete in git.
          const batchBase = gitHead(ctx.location.directory);

          const results: Array<Record<string, unknown>> = [];
          const pending: PendingMerge[] = [];
          const removals: Array<{ taskID: string; staffID: string; removal: WorktreeRemoval }> = [];

          try {
            for (const task of tasks) {
              if (task.status !== "integrated") {
                throw new Error(`cannot integrate task in status ${task.status}: ${task.id}`);
              }
              const staff = task.staffID ? store.getStaff(task.staffID) : undefined;
              if (!staff?.worktreeDirectory) {
                if (mission.isolation === "none") {
                  const merged = store.markMergedInPlace(args.mission_id, task.id);
                  results.push({ taskID: task.id, inPlace: true, task: merged });
                  continue;
                }
                results.push({ taskID: task.id, skipped: true, reason: "no worktree" });
                continue;
              }

              const integration = integrateWorktree(ctx.location.directory, staff.worktreeDirectory, {
                strategy,
              });
              const merged = store.markMerged(
                args.mission_id,
                task.id,
                integration.commit,
                integration.sourceCommit,
              );
              pending.push({ task, integration });
              results.push({
                taskID: task.id,
                commit: integration.commit,
                sourceCommit: integration.sourceCommit,
                alreadyMerged: integration.alreadyMerged,
                strategy: integration.strategy,
                task: merged,
              });
            }
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            const rolledBack: string[] = [];
            if (batchBase && pending.length > 0) {
              gitResetHard(ctx.location.directory, batchBase);
              for (const item of pending) {
                store.unmarkMerged(args.mission_id, item.task.id, reason);
                rolledBack.push(item.task.id);
              }
            }
            throw new Error(
              `${reason}. Batch rolled back: ${rolledBack.length} cherry-pick(s) reverted` +
                `${rolledBack.length > 0 ? ` (${rolledBack.join(", ")})` : ""}; worktrees kept for retry`,
            );
          }

          // Only after every cherry-pick landed do we drop the isolation. A dirty
          // worktree is left in place and reported instead of force-deleted.
          for (const item of pending) {
            const staff = item.task.staffID ? store.getStaff(item.task.staffID) : undefined;
            if (!staff?.worktreeDirectory) continue;
            const removal = await removeWorktree(ctx, staff.worktreeDirectory);
            removals.push({ taskID: item.task.id, staffID: staff.id, removal });
            if (removal.removed) {
              store.clearWorktree(staff.id);
              store.addEvent(args.mission_id, item.task.id, "worktree.removed", {
                directory: staff.worktreeDirectory,
              });
            } else {
              store.addEvent(args.mission_id, item.task.id, "worktree.remove_failed", {
                directory: staff.worktreeDirectory,
                error: removal.error ?? "unknown",
              });
            }
          }

          const byTask = new Map(removals.map((entry) => [entry.taskID, entry.removal]));
          for (const result of results) {
            const removal = byTask.get(String(result.taskID));
            if (removal) {
              result.worktreeRemoved = removal.removed;
              result.worktreeError = removal.error;
            }
          }

          return ok({
            integrated: results.filter((result) => !("skipped" in result)).length,
            strategy,
            results,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
