import { Plugin } from "@opencode/plugin";
import { openSquadDb } from "./db/index";
import { SquadStore } from "./db/store";
import { registerAppraiseTool } from "./tools/appraise";
import { registerAssignTool } from "./tools/assign";
import { registerBudgetTool } from "./tools/budget";
import { registerCareerTool } from "./tools/career";
import { registerCheckTool } from "./tools/check";
import { registerFireTool } from "./tools/fire";
import { registerFinalizeTool } from "./tools/finalize";
import { registerHireTool } from "./tools/hire";
import { registerMissionTool } from "./tools/mission";
import { registerPlanTool } from "./tools/plan";
import { registerProbeTool } from "./tools/probe";
import { registerReportTool } from "./tools/report";
import { registerReviewTool } from "./tools/review";
import { registerScorecardTool } from "./tools/scorecard";
import { registerStaffTool } from "./tools/staff";
import { registerStatusTool } from "./tools/status";
import { registerTasksTool } from "./tools/tasks";
import { registerVerdictTool } from "./tools/verdict";
import { registerWaitTool } from "./tools/wait";
import { VERSION } from "./version";

export default Plugin.define({
  id: "squad",
  async setup(ctx) {
    const db = openSquadDb(ctx.location.directory);
    const store = new SquadStore(db);

    const registrations = await Promise.all([
      registerStatusTool(ctx, store),
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
    ]);

    console.log(
      `[squad] v${VERSION} loaded at ${ctx.location.directory} (OpenCode ${ctx.app.version})`,
    );

    return async () => {
      for (const registration of registrations) {
        await registration.dispose();
      }
      db.close();
    };
  },
});
