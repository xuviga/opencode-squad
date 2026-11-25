import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type ReportInput = {
  mission_id?: string;
};

export async function registerReportTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "report",
      description:
        "Build a mission report: plan, task statuses, worker reports, verdicts, staff, budget, and recent events.",
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
        },
        required: ["mission_id"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as ReportInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_report",
            resources: [args.mission_id],
          });

          const mission = store.requireMission(args.mission_id);
          const plan = store.getPlan(args.mission_id);
          const tasks = store.listTasks(args.mission_id);
          const budget = store.budgetSummary(args.mission_id);
          const metrics = store.metrics(args.mission_id);
          const staff = store.listStaff(100);
          const events = store.listEvents(args.mission_id, 50);
          const disputes = store.listDisputes(args.mission_id).map((dispute) => ({
            ...dispute,
            messages: store.listDisputeMessages(dispute.id),
          }));
          const audits = store.listAudits(args.mission_id);
          const lessons = store.listLessons(args.mission_id);

          const taskLines = tasks.map((task) => {
            const report = task.report as { status?: string; summary?: string } | undefined;
            const verdict = task.verdict as
              | { verdict?: string; severity?: string; findings?: unknown[] }
              | undefined;
            return [
              `- [${task.status}] ${task.id} — ${task.title} (${task.role}/${task.grade}, attempts ${task.attempts})`,
              report ? `  report: ${report.status ?? "?"} — ${report.summary ?? ""}` : "",
              verdict
                ? `  verdict: ${verdict.verdict ?? "?"}/${verdict.severity ?? "?"} (${verdict.findings?.length ?? 0} findings)`
                : "",
            ]
              .filter(Boolean)
              .join("\n");
          });

          const markdown = [
            `# SQUAD mission ${mission.id}`,
            "",
            `**${mission.title}**`,
            `Status: \`${mission.status}\` · plan v${mission.planVersion}`,
            `Cost: $${budget.actualCostUsd.toFixed(6)} of $${(budget.expectedCostUsd ?? 0).toFixed(6)} expected`,
            `Delivery: pass@1 ${metrics.passAt1 === null ? "n/a" : `${Math.round(metrics.passAt1 * 100)}%`}, rework ${metrics.reworkRate === null ? "n/a" : `${Math.round(metrics.reworkRate * 100)}%`}, cost per integrated task $${metrics.costPerIntegratedTaskUsd === null ? "n/a" : metrics.costPerIntegratedTaskUsd.toFixed(6)}`,
            "",
            "## Tasks",
            ...taskLines,
            "",
            "## Staff",
            ...staff.map(
              (member) =>
                `- ${member.id} — ${member.persona}/${member.grade} · ${member.agent ?? "?"} · ${member.status} · session ${member.sessionID ?? "—"}`,
            ),
            "",
            "## Recent events",
            ...events.map(
              (event) =>
                `- ${event.created_at} · ${event.type}${event.task_id ? ` · ${event.task_id}` : ""}`,
            ),
            "",
            "## Disputes",
            ...(disputes.length
              ? disputes.map(
                  (dispute) =>
                    `- ${dispute.id} · ${dispute.status} · ${dispute.taskID} · round ${dispute.round} · ${dispute.claim}`,
                )
              : ["- none"]),
            "",
            "## Audits",
            ...(audits.length
              ? audits.map(
                  (audit) =>
                    `- ${audit.id} · ${audit.kind} · ${audit.status} · ${audit.taskID}`,
                )
              : ["- none"]),
            "",
            "## Lessons",
            ...(lessons.length
              ? lessons.map((lesson) => `- ${lesson.text}`)
              : ["- none"]),
          ].join("\n");

          return ok({
            mission,
            plan,
            tasks: tasks.map(({ brief, rawReport, ...task }) => task),
            staff,
            budget,
            metrics,
            events,
            disputes,
            audits,
            lessons,
            markdown,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
