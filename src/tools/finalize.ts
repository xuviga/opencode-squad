import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { missionEvidence } from "../runtime/evidence";
import { removeWorktrees } from "../runtime/worktree";
import { fail, ok } from "./result";

type FinalizeInput = {
  mission_id?: string;
};

export async function registerFinalizeTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "finalize",
      description:
        "Global integration gate: finalize a mission in integrating status only when every task is integrated, every integration commit is an ancestor of main HEAD, and the second-review quota is met. Removes the mission worktrees afterwards.",
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
        const args = (input ?? {}) as FinalizeInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_finalize",
            resources: [args.mission_id],
          });

          const tasks = store.listTasks(args.mission_id);
          const isolation = store.requireMission(args.mission_id).isolation;
          const evidence = missionEvidence(ctx.location.directory, tasks, { isolation });
          if (!evidence.ok) {
            throw new Error(
              `cannot finalize: integration evidence failed: ${evidence.problems.join("; ")}`,
            );
          }

          const mission = store.finalizeMission(args.mission_id);

          const staffIDs = [
            ...new Set(
              tasks
                .map((task) => task.staffID)
                .filter((staffID): staffID is string => !!staffID),
            ),
          ];
          const directories: string[] = [];
          for (const staffID of staffIDs) {
            const staff = store.getStaff(staffID);
            if (staff?.worktreeDirectory) directories.push(staff.worktreeDirectory);
          }
          const removals = await removeWorktrees(ctx, directories);
          for (const removal of removals) {
            const owner = staffIDs
              .map((staffID) => store.getStaff(staffID))
              .find((staff) => staff?.worktreeDirectory === removal.directory);
            if (removal.removed && owner) store.clearWorktree(owner.id);
          }

          return ok({ mission, evidence, worktrees: removals });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
