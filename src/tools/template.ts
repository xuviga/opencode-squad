import type { Plugin } from "@opencode/plugin";
import { buildPlanTemplate, listTemplates } from "../classes";
import { TASK_CLASSES, type TaskClass } from "../plan";
import { fail, ok } from "./result";

type TemplateInput = {
  action?: "list" | "build";
  class?: string;
  goal?: string;
  prefix?: string;
  role?: string;
  capabilities?: string[];
  expectedCostUsd?: number;
  notes?: string;
};

export async function registerTemplateTool(ctx: Plugin.Context) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "template",
      description:
        "List SQUAD class templates or build a plan draft for research, writing, design, data, ops, code, review, planning or creative work. The draft is validated and can be submitted with squad_plan action=submit.",
      input: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "build"] },
          class: { type: "string", enum: [...TASK_CLASSES] },
          goal: { type: "string" },
          prefix: { type: "string" },
          role: { type: "string" },
          capabilities: { type: "array", items: { type: "string" } },
          expectedCostUsd: { type: "number" },
          notes: { type: "string" },
        },
        required: ["action"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input) => {
        const args = (input ?? {}) as TemplateInput;
        try {
          if (args.action === "list") {
            return ok({ templates: listTemplates() });
          }
          if (args.action !== "build") {
            throw new Error(`unknown action: ${String(args.action)}`);
          }
          if (!args.class) throw new Error("class is required for build");
          if (!(TASK_CLASSES as readonly string[]).includes(args.class)) {
            throw new Error(`unknown task class: ${args.class}`);
          }
          if (!args.goal) throw new Error("goal is required for build");

          const plan = buildPlanTemplate({
            class: args.class as TaskClass,
            goal: args.goal,
            prefix: args.prefix,
            role: args.role,
            capabilities: args.capabilities,
            expectedCostUsd: args.expectedCostUsd,
            notes: args.notes,
          });
          return ok({
            class: args.class,
            plan,
            tasks: plan.tasks.length,
            capabilities: Array.from(
              new Set(plan.tasks.flatMap((task) => task.capabilities ?? [])),
            ),
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
