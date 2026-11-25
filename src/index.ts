import { Plugin } from "@opencode/plugin";
import { loadSquadConfig } from "./config";
import { acquireSquadDb } from "./db/index";
import { SquadStore } from "./db/store";
import { SquadRpc } from "./rpc";
import { ensureInPlaceLock } from "./runtime/inplace-lock";
import { startJanitor } from "./runtime/janitor";
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
import { registerGcTool } from "./tools/gc";
import { registerHireTool } from "./tools/hire";
import { registerImageTool } from "./tools/image";
import { registerIntegrateTool } from "./tools/integrate";
import { registerLookTool } from "./tools/look";
import { registerMissionTool } from "./tools/mission";
import { registerPlanTool } from "./tools/plan";
import { registerPreviewTool } from "./tools/preview";
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
    const config = loadSquadConfig(ctx.location.directory);
    const { db, release } = acquireSquadDb(ctx.location.directory);
    const store = new SquadStore(db, config);
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
      registerGcTool(ctx, store),
      registerDisputeTool(ctx, store),
      registerAuditTool(ctx, store),
      registerIntegrateTool(ctx, store),
      registerTemplateTool(ctx),
      registerImageTool(ctx, store),
      registerCapabilitiesTool(ctx),
      registerCancelTool(ctx, store),
      registerPreviewTool(ctx),
      registerLookTool(ctx, store),
    ]);

    let rpcRegistration:
      | Awaited<ReturnType<typeof ctx.rpc.register>>
      | undefined;
    try {
      rpcRegistration = await ctx.rpc.register(SquadRpc, {
        state: async (input) => {
          const args = (input ?? {}) as { mission_id?: string };
          return JSON.parse(JSON.stringify(store.tuiState(args.mission_id)));
        },
        plan: async (input) => {
          const args = (input ?? {}) as {
            mission_id: string;
            action: "approve" | "reject";
            note?: string;
          };
          if (args.action === "approve") {
            const mission = store.requireMission(args.mission_id);
            if (mission.isolation === "none") {
              const lock = ensureInPlaceLock(ctx.location.directory, mission.id, (holderID) => {
                const holder = store.getMission(holderID);
                return !holder || ["done", "failed", "aborted"].includes(holder.status);
              });
              if (!lock.ok) {
                throw new Error(
                  `folder is locked by in-place mission ${lock.holder?.missionID} since ${lock.holder?.createdAt}`,
                );
              }
            }
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

    const stopJanitor = startJanitor(store, config, (report) => {
      if (report.stale.length === 0) return;
      const aborted = report.aborted.length > 0 ? `, aborted ${report.aborted.length}` : "";
      console.warn(
        `[squad] gc: ${report.stale.length} stale mission(s)${aborted} (stale > ${report.staleAfterMinutes}m)`,
      );
    });

    return async () => {
      stopJanitor();
      for (const registration of registrations) {
        await registration.dispose();
      }
      await rpcRegistration?.dispose();
      // The shared handle stays open: tool calls from a disposed instance may
      // still be in flight after a plugin reload.
      release();
    };
  },
});
