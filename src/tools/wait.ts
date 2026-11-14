import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { extractLastAssistantText } from "../runtime/messages";
import { fail, ok } from "./result";

type WaitInput = {
  mission_id?: string;
  task_id?: string;
  timeout_ms?: number;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export async function registerWaitTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "wait",
      description:
        "Wait for an assigned SQUAD task to go idle, capture the worker's raw report, record per-session cost/tokens in the ledger, and move the task to submitted.",
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
          task_id: { type: "string" },
          timeout_ms: { type: "number" },
        },
        required: ["mission_id", "task_id"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as WaitInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          if (!args.task_id) throw new Error("task_id is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_wait",
            resources: [args.task_id],
          });

          let task = store.requireTask(args.mission_id, args.task_id);
          if (task.status === "submitted") {
            return ok({ task, already_submitted: true });
          }
          if (!task.sessionID) throw new Error(`task has no session: ${task.id}`);

          const sessionID = task.sessionID;
          const staff = task.staffID ? store.getStaff(task.staffID) : undefined;
          const timeoutMs = Math.max(
            5_000,
            Math.min(args.timeout_ms ?? 300_000, 600_000),
          );

          try {
            await ctx.session.wait(
              { sessionID },
              { signal: AbortSignal.timeout(timeoutMs) },
            );
          } catch (error) {
            const message = errorMessage(error);
            let info: Awaited<ReturnType<typeof ctx.session.get>> | undefined;
            try {
              info = await ctx.session.get({ sessionID });
            } catch {
              info = undefined;
            }

            if (info && !store.hasLedgerEntry(args.mission_id, args.task_id, sessionID)) {
              store.recordLedger({
                missionID: args.mission_id,
                taskID: args.task_id,
                staffID: task.staffID,
                sessionID,
                provider: staff?.provider,
                model: staff?.model,
                variant: staff?.variant,
                inputTokens: info.tokens.input,
                outputTokens: info.tokens.output,
                cost: info.cost,
              });
            }

            await ctx.session.interrupt({ sessionID, resume: false }).catch(() => undefined);
            const failed = store.failTask(
              args.mission_id,
              args.task_id,
              `wait failed: ${message}`,
            );
            return ok({
              timedOut: true,
              error: message,
              task: failed,
              session: info
                ? {
                    id: info.id,
                    outcome: info.outcome,
                    cost: info.cost,
                    tokens: info.tokens,
                  }
                : undefined,
            });
          }

          const messages = await ctx.session.context({ sessionID });
          const rawReport = extractLastAssistantText(messages);
          const info = await ctx.session.get({ sessionID });

          if (!store.hasLedgerEntry(args.mission_id, args.task_id, sessionID)) {
            store.recordLedger({
              missionID: args.mission_id,
              taskID: args.task_id,
              staffID: task.staffID,
              sessionID,
              provider: staff?.provider,
              model: staff?.model,
              variant: staff?.variant,
              inputTokens: info.tokens.input,
              outputTokens: info.tokens.output,
              cost: info.cost,
            });
          }

          task = store.saveRawReport(args.mission_id, args.task_id, rawReport);
          return ok({
            task,
            session_id: sessionID,
            message_count: messages.length,
            raw_report: rawReport,
            cost: info.cost,
            tokens: info.tokens,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
