import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { nextGrade } from "../personas";
import { taskDiff } from "../runtime/diff";
import { hireEmployee } from "../runtime/hire";
import { extractLastAssistantText } from "../runtime/messages";
import { parseVerdictText } from "../verdict";
import { fail, ok } from "./result";

type AuditInput = {
  action?: "task" | "sample";
  mission_id?: string;
  task_id?: string;
  timeout_ms?: number;
};

const VERDICT_SCHEMA = {
  verdict: "pass | fail",
  severity: "low | medium | high | critical",
  findings: [
    { id: "F1", claim: "what is wrong", evidence: "path:line", required_fix: "what must change" },
  ],
  checked: ["diff", "tests", "acceptance"],
};

async function runTaskAudit(
  ctx: Plugin.Context,
  store: SquadStore,
  missionID: string,
  taskID: string,
  parentSessionID: string,
  timeoutMs: number,
) {
  const task = store.requireTask(missionID, taskID);
  if (task.status !== "integrated") {
    throw new Error(`cannot audit task in status ${task.status}`);
  }
  if (store.hasAudit(missionID, taskID)) {
    throw new Error(`task already audited: ${taskID}`);
  }
  if (!task.reviewerStaffID) {
    throw new Error(`task has no first reviewer: ${taskID}`);
  }

  const reviewerGrade = nextGrade(task.grade);
  const reviewer = await hireEmployee(ctx, store, {
    missionID,
    persona: "reviewer",
    grade: reviewerGrade,
    parentSessionID,
    title: `SQUAD second reviewer for ${taskID} (${reviewerGrade})`,
  });

  let diff: unknown;
  try {
    diff = await taskDiff(ctx, store, task);
  } catch (error) {
    diff = { error: error instanceof Error ? error.message : String(error) };
  }

  const prompt = [
    `You are SQUAD second reviewer at grade ${reviewerGrade}.`,
    "The first reviewer passed this task. Verify it independently and adversarially.",
    "You see only the Task Brief, Worker Report, and diff. You do not see the first reviewer's reasoning.",
    "Do not trust the report: verify the acceptance criteria against the evidence and diff.",
    "Return ONLY one JSON object, without markdown fences, matching this schema:",
    JSON.stringify(VERDICT_SCHEMA, null, 2),
    "Rules: a pass must include diff and tests in checked; a fail needs at least one finding with concrete evidence.",
    "Task Brief:",
    JSON.stringify(task.brief ?? {}, null, 2),
    "Worker Report:",
    task.rawReport ?? "(none)",
    "Diff:",
    JSON.stringify(diff, null, 2).slice(0, 24_000),
  ].join("\n\n");

  await ctx.session.prompt({
    sessionID: reviewer.sessionID,
    text: prompt,
    delivery: "queue",
  });
  await ctx.session.wait(
    { sessionID: reviewer.sessionID },
    { signal: AbortSignal.timeout(Math.max(5_000, Math.min(timeoutMs, 600_000))) },
  );

  const info = await ctx.session.get({ sessionID: reviewer.sessionID });
  if (!store.hasLedgerEntry(missionID, taskID, reviewer.sessionID)) {
    store.recordLedger({
      missionID,
      taskID,
      staffID: reviewer.staff.id,
      sessionID: reviewer.sessionID,
      provider: reviewer.staff.provider,
      model: reviewer.staff.model,
      variant: reviewer.staff.variant,
      inputTokens: info.tokens.input,
      outputTokens: info.tokens.output,
      cost: info.cost,
    });
  }

  const messages = await ctx.session.context({ sessionID: reviewer.sessionID });
  const rawVerdict = extractLastAssistantText(messages);
  const verdict = parseVerdictText(rawVerdict);
  const audit = store.recordAudit({
    missionID,
    taskID,
    kind: "second_review",
    status: verdict.verdict === "pass" ? "pass" : "fail",
    reviewerStaffID: reviewer.staff.id,
    reviewerSessionID: reviewer.sessionID,
    verdict,
    notes:
      verdict.verdict === "fail"
        ? verdict.findings.map((finding) => `${finding.id}: ${finding.claim}`).join("; ")
        : "second review passed",
  });

  return {
    audit,
    verdict,
    task: store.requireTask(missionID, taskID),
    reviewer: reviewer.staff,
    reviewer_session_id: reviewer.sessionID,
    cost: info.cost,
    tokens: info.tokens,
    raw_verdict: rawVerdict,
  };
}

export async function registerAuditTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "audit",
      description:
        "Run a selective second review (or sample one integrated task) to detect a false pass. A failed audit returns the task and penalizes the first reviewer.",
      input: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["task", "sample"] },
          mission_id: { type: "string" },
          task_id: { type: "string" },
          timeout_ms: { type: "number" },
        },
        required: ["action", "mission_id"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as AuditInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          const missionID = args.mission_id;
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_audit",
            resources: [args.task_id ?? args.mission_id],
          });

          if (args.action === "task") {
            if (!args.task_id) throw new Error("task_id is required");
            const result = await runTaskAudit(
              ctx,
              store,
              missionID,
              args.task_id,
              context.sessionID,
              args.timeout_ms ?? 300_000,
            );
            return ok(result);
          }

          const candidates = store
            .listTasks(missionID)
            .filter((task) => task.status === "integrated" && !store.hasAudit(missionID, task.id));
          if (candidates.length === 0) {
            return ok({ sampled: 0, message: "no unaudited integrated tasks" });
          }
          const target = candidates[0]!;
          const result = await runTaskAudit(
            ctx,
            store,
            missionID,
            target.id,
            context.sessionID,
            args.timeout_ms ?? 300_000,
          );
          return ok({ sampled: 1, ...result });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
