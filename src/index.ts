import { Plugin } from "@opencode/plugin";
import { openSquadDb } from "./db/index";
import { SquadStore } from "./db/store";
import { SquadRpc } from "./rpc";
import { registerAppraiseTool } from "./tools/appraise";
import { registerAssignTool } from "./tools/assign";
import { registerAuditTool } from "./tools/audit";
import { registerBudgetTool } from "./tools/budget";
import { registerCancelTool } from "./tools/cancel";
import { registerCareerTool } from "./tools/career";
import { registerCapabilitiesTool } from "./tools/capabilities";
import { registerCheckTool } from "./tools/check";
import { registerDisputeTool } from "./tools/dispute";
import { registerFireTool } from "./tools/fire";
import { registerFinalizeTool } from "./tools/finalize";
import { registerHireTool } from "./tools/hire";
import { registerImageTool } from "./tools/image";
import { registerIntegrateTool } from "./tools/integrate";
import { registerMissionTool } from "./tools/mission";
import { registerPlanTool } from "./tools/plan";
import { registerProbeTool } from "./tools/probe";
import { registerReportTool } from "./tools/report";
import { registerReviewTool } from "./tools/review";
import { registerScorecardTool } from "./tools/scorecard";
import { registerStaffTool } from "./tools/staff";
import { registerStatusTool } from "./tools/status";
import type { RpcRuntimeState } from "./tools/status";
import { registerTasksTool } from "./tools/tasks";
import { registerTemplateTool } from "./tools/template";
import { registerVerdictTool } from "./tools/verdict";
import { registerWaitTool } from "./tools/wait";
import { VERSION } from "./version";

export default Plugin.define({
  id: "squad",
  async setup(ctx) {
    const db = openSquadDb(ctx.location.directory);
    const store = new SquadStore(db);
    const rpcState: RpcRuntimeState = { registered: false };

    const registrations = await Promise.all([
      registerStatusTool(ctx, store, rpcState),
      registerProbeTool(ctx),
      registerMissionTool(ctx, store),
      registerPlanTool(ctx, store),
      registerBudgetTool(ctx, store),
      registerHireTool(ctx, store),
      registerStaffTool(ctx, store),
      registerAssignTool(ctx, store),
      registerWaitTool(ctx, store),
      registerCheckTool(ctx, store),
      registerReviewTool(ctx, store),
      registerVerdictTool(ctx, store),
      registerReportTool(ctx, store),
      registerAppraiseTool(ctx, store),
      registerFireTool(ctx, store),
      registerScorecardTool(ctx, store),
      registerCareerTool(ctx, store),
      registerTasksTool(ctx, store),
      registerFinalizeTool(ctx, store),
      registerDisputeTool(ctx, store),
      registerAuditTool(ctx, store),
      registerIntegrateTool(ctx, store),
      registerTemplateTool(ctx),
      registerImageTool(ctx, store),
      registerCapabilitiesTool(ctx),
      registerCancelTool(ctx, store),
    ]);

    let rpcRegistration:
      | Awaited<ReturnType<typeof ctx.rpc.register>>
      | undefined;
    try {
      rpcRegistration = await ctx.rpc.register(SquadRpc, {
        state: async (input) => {
          const args = (input ?? {}) as { mission_id?: string };
          return store.tuiState(args.mission_id);
        },
        plan: async (input) => {
          const args = (input ?? {}) as {
            mission_id: string;
            action: "approve" | "reject";
            note?: string;
          };
          if (args.action === "approve") {
            return { mission: store.approvePlan(args.mission_id, args.note ?? "") };
          }
          return { mission: store.rejectPlan(args.mission_id, args.note ?? "") };
        },
      });
      rpcState.registered = true;
    } catch (error) {
      rpcState.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error("[squad] rpc failed", error);
    }

    console.log(
      `[squad] v${VERSION} loaded at ${ctx.location.directory} (OpenCode ${ctx.app.version})`,
    );

    return async () => {
      for (const registration of registrations) {
        await registration.dispose();
      }
      await rpcRegistration?.dispose();
      db.close();
    };
  },
});
