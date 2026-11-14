import { Plugin } from "@opencode/plugin";
import { openSquadDb } from "./db/index";
import { SquadStore } from "./db/store";
import { registerBudgetTool } from "./tools/budget";
import { registerMissionTool } from "./tools/mission";
import { registerPlanTool } from "./tools/plan";
import { registerProbeTool } from "./tools/probe";
import { registerStatusTool } from "./tools/status";
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
