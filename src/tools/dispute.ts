import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { parseRulingText } from "../ruling";
import { taskDiff } from "../runtime/diff";
import { hireEmployee } from "../runtime/hire";
import { extractLastAssistantText } from "../runtime/messages";
import { fail, ok } from "./result";

type DisputeInput = {
  action?: "open" | "reply" | "rule" | "list";
  mission_id?: string;
  task_id?: string;
  dispute_id?: string;
  claim?: string;
  role?: "worker" | "reviewer" | "boss";
  text?: string;
  evidence?: Record<string, unknown>;
  timeout_ms?: number;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export async function registerDisputeTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "dispute",
      description:
        "Open/reply/rule/list a SQUAD dispute. Rule hires a pro·max arbiter, reads the messages, brief, report, verdict and diff, and applies the ruling.",
      input: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["open", "reply", "rule", "list"] },
          mission_id: { type: "string" },
          task_id: { type: "string" },
          dispute_id: { type: "string" },
          claim: { type: "string" },
          role: { type: "string", enum: ["worker", "reviewer", "boss"] },
          text: { type: "string" },
          evidence: { type: "object", additionalProperties: true },
          timeout_ms: { type: "number" },
        },
        required: ["action"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as DisputeInput;
        try {
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_dispute",
            resources: [args.dispute_id ?? args.task_id ?? "*"],
          });

          if (args.action === "open") {
            if (!args.mission_id) throw new Error("mission_id is required");
            if (!args.task_id) throw new Error("task_id is required");
            if (!args.claim) throw new Error("claim is required");
            const dispute = store.openDispute(
              args.mission_id,
              args.task_id,
              args.claim,
              args.evidence,
            );
            return ok({ dispute });
          }

          if (args.action === "reply") {
            if (!args.dispute_id) throw new Error("dispute_id is required");
            if (!args.role) throw new Error("role is required");
            if (!args.text) throw new Error("text is required");
            const dispute = store.replyDispute(
              args.dispute_id,
              args.role,
              args.text,
              args.evidence,
            );
            return ok({
              dispute,
              messages: store.listDisputeMessages(args.dispute_id),
            });
          }

          if (args.action === "list") {
            if (!args.mission_id) throw new Error("mission_id is required");
            const disputes = store.listDisputes(args.mission_id);
            return ok({
              disputes: disputes.map((dispute) => ({
                ...dispute,
                messages: store.listDisputeMessages(dispute.id),
              })),
            });
          }

          if (args.action === "rule") {
            if (!args.dispute_id) throw new Error("dispute_id is required");
            const dispute = store.requireDispute(args.dispute_id);
            if (dispute.status !== "open") {
              throw new Error(`dispute is not open: ${dispute.status}`);
            }
            const task = store.requireTask(dispute.missionID, dispute.taskID);
            const messages = store.listDisputeMessages(dispute.id);

            let diff: unknown;
            try {
              diff = await taskDiff(ctx, store, task);
            } catch (error) {
              diff = { error: errorMessage(error) };
            }
            const diffText = JSON.stringify(diff, null, 2).slice(0, 24_000);

            const arbiter = await hireEmployee(ctx, store, {
              missionID: dispute.missionID,
              persona: "arbiter",
              grade: "G4",
              parentSessionID: context.sessionID,
              title: `SQUAD arbiter for ${dispute.id}`,
            });

            const prompt = [
              "You are SQUAD arbiter. Judge this dispute and return only the Ruling JSON.",
              "Dispute claim:",
              dispute.claim,
              "Dispute messages:",
              JSON.stringify(messages, null, 2),
              "Task Brief:",
              JSON.stringify(task.brief ?? {}, null, 2),
              "Worker Report:",
              task.rawReport ?? "(none)",
              "First Verdict:",
              JSON.stringify(task.verdict ?? {}, null, 2),
              "Diff:",
              diffText,
              "Return ONLY one JSON object, without markdown fences: {winner, reasoning, actions}.",
            ].join("\n\n");

            try {
              await ctx.session.prompt({
                sessionID: arbiter.sessionID,
                text: prompt,
                delivery: "queue",
              });
              await ctx.session.wait(
                { sessionID: arbiter.sessionID },
                { signal: AbortSignal.timeout(Math.max(5_000, Math.min(args.timeout_ms ?? 300_000, 600_000))) },
              );
            } catch (error) {
              await ctx.session.interrupt({ sessionID: arbiter.sessionID, resume: false }).catch(
                () => undefined,
              );
              return fail(error);
            }

            const info = await ctx.session.get({ sessionID: arbiter.sessionID });
            if (!store.hasLedgerEntry(dispute.missionID, dispute.taskID, arbiter.sessionID)) {
              store.recordLedger({
                missionID: dispute.missionID,
                taskID: dispute.taskID,
                staffID: arbiter.staff.id,
                sessionID: arbiter.sessionID,
                provider: arbiter.staff.provider,
                model: arbiter.staff.model,
                variant: arbiter.staff.variant,
                inputTokens: info.tokens.input,
                outputTokens: info.tokens.output,
                cost: info.cost,
              });
            }

            const arbiterMessages = await ctx.session.context({ sessionID: arbiter.sessionID });
            const rawRuling = extractLastAssistantText(arbiterMessages);
            let ruling;
            try {
              ruling = parseRulingText(rawRuling);
            } catch (error) {
              return fail(
                new Error(
                  `${error instanceof Error ? error.message : String(error)}. Raw ruling: ${rawRuling.slice(0, 2000)}`,
                ),
              );
            }

            const resolved = store.saveRuling(dispute.id, ruling);
            return ok({
              dispute: resolved,
              ruling,
              arbiter: arbiter.staff,
              arbiter_session_id: arbiter.sessionID,
              cost: info.cost,
              tokens: info.tokens,
            });
          }

          throw new Error(`unknown action: ${String(args.action)}`);
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
