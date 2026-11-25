import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { nextGrade } from "../personas";
import { taskDiff } from "../runtime/diff";
import { hireEmployee } from "../runtime/hire";
import { taskImages } from "../runtime/images";
import { formatDiffForPrompt } from "../runtime/snapshot";
import { releaseSession } from "../runtime/sessions";
import { requiredChecks } from "../verdict";
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
          const mission = store.requireMission(args.mission_id);
          const checks = requiredChecks(task.class, { isolation: mission.isolation });
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
          const diffText = formatDiffForPrompt(diff);
          const images = taskImages(ctx, store, task, diff);
          const worktree = (
            diff && typeof diff === "object" ? (diff as {
              worktree?: { head?: string; subject?: string; dirty?: boolean };
            }).worktree : undefined
          );

          const prompt = [
            `You are SQUAD ${reviewerPersona} at grade ${reviewerGrade}.`,
            "Review the task result independently and adversarially.",
            "You see only the Task Brief, the Worker Report, and the diff. You do not see the worker's reasoning.",
            "You have no tools: do not read files, search, or run commands. Judge only the provided material.",
            "Do not trust the report: verify the acceptance criteria against the evidence and diff.",
            "Fail ONLY when an acceptance criterion is unmet, the deliverable is missing/faked, or a correctness, security or data-loss defect has severity high or critical.",
            "Style, naming, formatting, documentation polish and optional improvements are a PASS with findings, not a fail. A fail with low or medium severity is invalid.",
            "If the diff reports partial patches or trimmed files, do not assume those files are unchanged: treat them as unverified and name them in the verdict.",
            `This task is class "${task.class}". Required checks for a pass: ${checks.join(", ")}.`,
            ...(mission.isolation === "none"
              ? [
                  "This mission runs in-place (no git worktree and no commit). The diff below is a filesystem snapshot comparison captured before the worker started; judge it as the change set.",
                ]
              : []),
            "If the class is not code-like there may be no diff; judge the worker report evidence against the acceptance criteria instead.",
            "External assets means remote URLs, @font-face rules, <image>, data: URIs or embedded binaries; font-family names for locally installed fonts are allowed.",
            ...(images.length > 0
              ? [
                  `Attached images: ${images.map((image) => image.name).join(", ")}. You can see them: judge visual quality, legibility and whether the artwork matches the brief. Do not reject an image merely because it is attached instead of embedded in the diff.`,
                ]
              : []),
            ...(worktree?.head
              ? [
                  `Worktree commit: ${worktree.head} (${worktree.subject ?? "no subject"}); working tree: ${worktree.dirty ? "dirty" : "clean"}. The orchestrator auto-commits the worktree after the worker report, so the report may predate this commit; judge commit claims by this metadata, not by the report.`,
                ]
              : []),
            "Return ONLY one JSON object, without markdown fences, matching this schema:",
            JSON.stringify(VERDICT_SCHEMA, null, 2),
            `Rules: a pass must have checked containing ${checks.join(", ")}; a fail must have at least one finding with concrete evidence.`,
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
              ...(images.length > 0
                ? { files: images.map(({ uri, name }) => ({ uri, name })) }
                : {}),
            });
          } catch (error) {
            store.resetReview(args.mission_id, args.task_id, "review prompt admission failed");
            const released = await releaseSession(ctx, reviewer.sessionID);
            store.addEvent(args.mission_id, args.task_id, "session.released", {
              sessionID: reviewer.sessionID,
              role: "reviewer",
              released,
              reason: "review prompt admission failed",
            });
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
