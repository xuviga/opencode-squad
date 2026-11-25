import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { parseReportText } from "../report";
import { taskDiff } from "../runtime/diff";
import { fail, ok } from "./result";

type CheckInput = {
  mission_id?: string;
  task_id?: string;
};

const REPORT_SCHEMA = {
  status: "done | blocked | failed",
  summary: "string",
  artifacts: { files: ["string"], commit: "string", images: ["string"] },
  evidence: [{ command: "string", exit: 0, tail: "string" }],
  risks: ["string"],
  open_questions: ["string"],
};

export async function registerCheckTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "check",
      description:
        "Validate a submitted worker report against the SQUAD Report schema, attach it to the task, and return the current working-tree diff.",
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
          task_id: { type: "string" },
        },
        required: ["mission_id", "task_id"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as CheckInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          if (!args.task_id) throw new Error("task_id is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_check",
            resources: [args.task_id],
          });

          const task = store.requireTask(args.mission_id, args.task_id);
          if (!task.rawReport) throw new Error(`task has no captured report: ${task.id}`);
          if (
            task.assignedAt &&
            (!task.reportCapturedAt || task.reportCapturedAt < task.assignedAt)
          ) {
            throw new Error(`report is stale for ${task.id}; run squad_wait after rework`);
          }

          let report: ReturnType<typeof parseReportText>;
          try {
            report = parseReportText(task.rawReport);
          } catch (error) {
            return fail(
              new Error(
                `${error instanceof Error ? error.message : String(error)}. Expected schema: ${JSON.stringify(REPORT_SCHEMA)}`,
              ),
            );
          }

          if (report.status === "blocked") {
            const blocked = store.blockTask(
              args.mission_id,
              args.task_id,
              report.summary,
            );
            return ok({
              task: blocked,
              report,
              blocked: true,
              next: "reassign with squad_assign when the blocker is resolved; attempts were not spent",
            });
          }
          if (report.status === "failed") {
            const failed = store.failTask(
              args.mission_id,
              args.task_id,
              `worker reported failure: ${report.summary}`,
            );
            return ok({ task: failed, report, failed: true });
          }

          const completed = store.completeTask(args.mission_id, args.task_id, report);
          const diff = await taskDiff(ctx, store, completed);
          return ok({
            task: completed,
            report,
            diff,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
