import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type AssignInput = {
  mission_id?: string;
  task_id?: string;
  staff_id?: string;
  context?: string[];
  constraints?: Record<string, unknown>;
  capabilities?: string[];
};

const REPORT_SCHEMA = {
  status: "done | blocked | failed",
  summary: "string",
  artifacts: {
    files: ["string"],
    commit: "string",
    images: ["string"],
  },
  evidence: [{ command: "string", exit: 0, tail: "string" }],
  risks: ["string"],
  open_questions: ["string"],
};

export async function registerAssignTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "assign",
      description:
        "Assign a mission task to an active SQUAD employee. Stores the Task Brief, prompts the employee's child session, and moves the task to running.",
      input: {
        type: "object",
        properties: {
          mission_id: { type: "string" },
          task_id: { type: "string" },
          staff_id: { type: "string" },
          context: { type: "array", items: { type: "string" } },
          capabilities: { type: "array", items: { type: "string" } },
          constraints: { type: "object", additionalProperties: true },
        },
        required: ["mission_id", "task_id", "staff_id"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as AssignInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          if (!args.task_id) throw new Error("task_id is required");
          if (!args.staff_id) throw new Error("staff_id is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_assign",
            resources: [args.task_id],
          });

          const task = store.requireTask(args.mission_id, args.task_id);
          const staff = store.requireStaff(args.staff_id);
          const sessionID = staff.sessionID;
          if (!sessionID) throw new Error(`staff has no session: ${staff.id}`);

          const brief = {
            task_id: task.id,
            mission_id: task.missionID,
            goal: task.title,
            class: task.class,
            role: staff.persona,
            grade: staff.grade,
            context: args.context ?? [],
            acceptance: task.acceptance,
            constraints: args.constraints ?? {},
            capabilities: args.capabilities ?? [],
            output_schema: "report_v1",
          };

          const prompt = [
            `You are SQUAD ${staff.persona} at grade ${staff.grade}.`,
            "Complete the task described in the Task Brief below.",
            "Return ONLY one JSON object, without markdown fences, matching this schema:",
            JSON.stringify(REPORT_SCHEMA, null, 2),
            "Task Brief:",
            JSON.stringify(brief, null, 2),
          ].join("\n\n");

          const assigned = store.assignTask(args.mission_id, args.task_id, args.staff_id, brief);

          try {
            await ctx.session.prompt({
              sessionID,
              text: prompt,
              delivery: "queue",
            });
          } catch (error) {
            store.failTask(args.mission_id, args.task_id, "prompt admission failed");
            throw error;
          }

          const running = store.markTaskRunning(args.mission_id, args.task_id);
          return ok({
            task: running,
            staff,
            session_id: sessionID,
            brief,
            assigned_status: assigned.status,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
