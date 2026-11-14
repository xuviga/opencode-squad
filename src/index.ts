import { Plugin } from "@opencode/plugin";
import { openSquadDb } from "./db/index";
import { SquadStore } from "./db/store";
import { registerAssignTool } from "./tools/assign";
import { registerBudgetTool } from "./tools/budget";
import { registerCheckTool } from "./tools/check";
import { registerHireTool } from "./tools/hire";
import { registerMissionTool } from "./tools/mission";
import { registerPlanTool } from "./tools/plan";
import { registerProbeTool } from "./tools/probe";
import { registerStaffTool } from "./tools/staff";
import { registerStatusTool } from "./tools/status";
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
