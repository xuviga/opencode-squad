import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { validatePlan } from "../plan";
import { ensureInPlaceLock } from "../runtime/inplace-lock";
import { fail, ok } from "./result";

type PlanInput = {
  action?: "submit" | "get" | "approve" | "reject";
  mission_id?: string;
  plan?: unknown;
  note?: string;
};

export async function registerPlanTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "plan",
      description:
        "Submit, inspect, approve, or reject a SQUAD mission plan. Submit validates the plan and materializes tasks; approve moves the mission from plan_gate to staffing.",
      input: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["submit", "get", "approve", "reject"] },
          mission_id: { type: "string" },
          note: { type: "string" },
          plan: {
            type: "object",
            properties: {
              goal: { type: "string" },
              expectedCostUsd: { type: "number" },
              notes: { type: "string" },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    class: { type: "string" },
                    role: { type: "string" },
                    grade: { type: "string" },
                    acceptance: { type: "array", items: { type: "string" } },
                    dependsOn: { type: "array", items: { type: "string" } },
                    capabilities: { type: "array", items: { type: "string" } },
                    paths: { type: "array", items: { type: "string" } },
                  },
                  required: ["id", "title", "class", "role", "grade", "acceptance"],
                  additionalProperties: false,
                },
              },
            },
            required: ["goal", "tasks"],
            additionalProperties: false,
          },
        },
        required: ["action"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = input as PlanInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");

          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_plan",
            resources: [args.mission_id],
          });

          switch (args.action) {
            case "submit": {
              if (args.plan === undefined) throw new Error("plan is required for submit");
              const plan = validatePlan(args.plan);
              const result = store.submitPlan(args.mission_id, plan);
              return ok({
                mission: result.mission,
                mission_id: result.mission.id,
                plan: result.plan,
                version: result.version,
              });
            }
            case "get": {
              const mission = store.requireMission(args.mission_id);
              return ok({ mission, plan: store.getPlan(args.mission_id) });
            }
            case "approve": {
              const mission = store.requireMission(args.mission_id);
              if (mission.isolation === "none") {
                const lock = ensureInPlaceLock(ctx.location.directory, mission.id, (holderID) => {
                  const holder = store.getMission(holderID);
                  return !holder || ["done", "failed", "aborted"].includes(holder.status);
                });
                if (!lock.ok) {
                  throw new Error(
                    `folder is locked by in-place mission ${lock.holder?.missionID} since ${lock.holder?.createdAt}; ` +
                      `finalize or cancel it before starting another in-place mission`,
                  );
                }
              }
              const missionApproved = store.approvePlan(args.mission_id, args.note ?? "");
              return ok({ mission: missionApproved, mission_id: missionApproved.id });
            }
            case "reject": {
              const mission = store.rejectPlan(args.mission_id, args.note ?? "");
              return ok({ mission, mission_id: mission.id });
            }
            default:
              throw new Error(`unknown action: ${String(args.action)}`);
          }
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
