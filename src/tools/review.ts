import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { nextGrade } from "../personas";
import { taskDiff } from "../runtime/diff";
import { hireEmployee } from "../runtime/hire";
import { fail, ok } from "./result";

type ReviewInput = {
  mission_id?: string;
  task_id?: string;
};

const VERDICT_SCHEMA = {
  verdict: "pass | fail",
  severity: "low | medium | high | critical",
  findings: [
    {
      id: "F1",
      claim: "what is wrong",
      evidence: "path:line or command output",
      required_fix: "what must change",
    },
  ],
  checked: ["diff", "tests", "acceptance"],
};

export async function registerReviewTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "review",
      description:
        "Start a blind review: hire a reviewer one grade above the worker, attach it to the submitted task, and send only the Task Brief, Worker Report, and diff.",
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
        const args = (input ?? {}) as ReviewInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          if (!args.task_id) throw new Error("task_id is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_review",
            resources: [args.task_id],
          });

          const task = store.requireTask(args.mission_id, args.task_id);
          if (task.status === "in_review" && task.reviewerSessionID) {
            return ok({
              task,
              already_in_review: true,
              reviewer_session_id: task.reviewerSessionID,
            });
          }
          if (task.status !== "submitted") {
            throw new Error(`cannot review task in status ${task.status}`);
          }
          if (!task.rawReport) {
            throw new Error(`task has no captured report: ${task.id}; run squad_wait`);
          }
          if (
            task.assignedAt &&
            (!task.reportCapturedAt || task.reportCapturedAt < task.assignedAt)
          ) {
            throw new Error(`report is stale for ${task.id}; run squad_wait after rework`);
          }

          const reviewerGrade = nextGrade(task.grade);
          const reviewerPersona = task.grade === "G4" ? "critic" : "reviewer";
          const reviewer = await hireEmployee(ctx, store, {
            missionID: args.mission_id,
            persona: reviewerPersona,
            grade: reviewerGrade,
            parentSessionID: context.sessionID,
            title: `SQUAD reviewer for ${args.task_id} (${reviewerGrade})`,
          });

          let diff: unknown;
          try {
            diff = await taskDiff(ctx, store, task);
          } catch (error) {
            diff = { error: error instanceof Error ? error.message : String(error) };
          }
          const diffText = JSON.stringify(diff, null, 2).slice(0, 24_000);

          const prompt = [
            `You are SQUAD ${reviewerPersona} at grade ${reviewerGrade}.`,
            "Review the task result independently and adversarially.",
            "You see only the Task Brief, the Worker Report, and the diff. You do not see the worker's reasoning.",
            "You have no tools: do not read files, search, or run commands. Judge only the provided material.",
            "Do not trust the report: verify the acceptance criteria against the evidence and diff.",
            "Return ONLY one JSON object, without markdown fences, matching this schema:",
            JSON.stringify(VERDICT_SCHEMA, null, 2),
            "Rules: a pass must have checked containing diff and tests; a fail must have at least one finding with concrete evidence.",
            "Task Brief:",
            JSON.stringify(task.brief ?? {}, null, 2),
            "Worker Report:",
            task.rawReport ?? "(none)",
            "Diff:",
            diffText,
          ].join("\n\n");

          const reviewed = store.assignReview(
            args.mission_id,
            args.task_id,
            reviewer.staff.id,
            reviewer.sessionID,
          );

          try {
            await ctx.session.prompt({
              sessionID: reviewer.sessionID,
              text: prompt,
              delivery: "queue",
            });
          } catch (error) {
            store.resetReview(args.mission_id, args.task_id, "review prompt admission failed");
            throw error;
          }

          return ok({
            task: reviewed,
            reviewer: reviewer.staff,
            reviewer_staff_id: reviewer.staff.id,
            reviewer_session_id: reviewer.sessionID,
            reviewer_grade: reviewerGrade,
            reviewer_persona: reviewerPersona,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
