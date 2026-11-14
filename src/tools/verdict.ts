import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { extractLastAssistantText } from "../runtime/messages";
import { parseVerdictText } from "../verdict";
import { fail, ok } from "./result";

type VerdictInput = {
  mission_id?: string;
  task_id?: string;
  timeout_ms?: number;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export async function registerVerdictTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "verdict",
      description:
        "Wait for the blind reviewer, validate the verdict, record reviewer usage, and apply pass (integrated) or fail (returned) with a rework limit.",
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
        const args = (input ?? {}) as VerdictInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          if (!args.task_id) throw new Error("task_id is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_verdict",
            resources: [args.task_id],
          });

          let task = store.requireTask(args.mission_id, args.task_id);
          if (task.status !== "in_review") {
            throw new Error(`cannot read verdict in task status ${task.status}`);
          }
          if (!task.reviewerSessionID) throw new Error("task has no reviewer session");

          const reviewerSessionID = task.reviewerSessionID;
          const reviewer = task.reviewerStaffID
            ? store.getStaff(task.reviewerStaffID)
            : undefined;
          const timeoutMs = Math.max(5_000, Math.min(args.timeout_ms ?? 300_000, 600_000));

          try {
            await ctx.session.wait(
              { sessionID: reviewerSessionID },
              { signal: AbortSignal.timeout(timeoutMs) },
            );
          } catch (error) {
            const message = errorMessage(error);
            let info: Awaited<ReturnType<typeof ctx.session.get>> | undefined;
            try {
              info = await ctx.session.get({ sessionID: reviewerSessionID });
            } catch {
              info = undefined;
            }
            if (info && !store.hasLedgerEntry(args.mission_id, args.task_id, reviewerSessionID)) {
              store.recordLedger({
                missionID: args.mission_id,
                taskID: args.task_id,
                staffID: task.reviewerStaffID,
                sessionID: reviewerSessionID,
                provider: reviewer?.provider,
                model: reviewer?.model,
                variant: reviewer?.variant,
                inputTokens: info.tokens.input,
                outputTokens: info.tokens.output,
                cost: info.cost,
              });
            }
            await ctx.session.interrupt({ sessionID: reviewerSessionID, resume: false }).catch(
              () => undefined,
            );
            const reset = store.resetReview(
              args.mission_id,
              args.task_id,
              `review wait failed: ${message}`,
            );
            return ok({ timedOut: true, error: message, task: reset });
          }

          const messages = await ctx.session.context({ sessionID: reviewerSessionID });
          const rawVerdict = extractLastAssistantText(messages);
          const info = await ctx.session.get({ sessionID: reviewerSessionID });

          if (!store.hasLedgerEntry(args.mission_id, args.task_id, reviewerSessionID)) {
            store.recordLedger({
              missionID: args.mission_id,
              taskID: args.task_id,
              staffID: task.reviewerStaffID,
              sessionID: reviewerSessionID,
              provider: reviewer?.provider,
              model: reviewer?.model,
              variant: reviewer?.variant,
              inputTokens: info.tokens.input,
              outputTokens: info.tokens.output,
              cost: info.cost,
            });
          }

          let verdict;
          try {
            verdict = parseVerdictText(rawVerdict, task.class);
          } catch (error) {
            store.resetReview(
              args.mission_id,
              args.task_id,
              "invalid reviewer verdict",
            );
            return fail(
              new Error(
                `${error instanceof Error ? error.message : String(error)}. Raw verdict: ${rawVerdict.slice(0, 2000)}`,
              ),
            );
          }

          task = store.saveVerdict(args.mission_id, args.task_id, verdict);
          return ok({
            task,
            verdict,
            cost: info.cost,
            tokens: info.tokens,
            raw_verdict: rawVerdict,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
