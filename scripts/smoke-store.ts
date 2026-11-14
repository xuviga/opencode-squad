import { fileURLToPath } from "node:url";
import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";

const directory = fileURLToPath(new URL("../dev", import.meta.url));
const db = openSquadDb(directory);
const store = new SquadStore(db);

const mission = store.createMission("SQUAD M0 smoke", "Validate SQLite mission flow");
const submitted = store.submitPlan(mission.id, {
  goal: "Validate SQLite mission flow",
  expectedCostUsd: 0.01,
  tasks: [
    {
      id: "t_001",
      title: "Smoke task",
      class: "code",
      role: "implementer",
      grade: "G2",
      acceptance: ["smoke passes"],
    },
  ],
});
const approved = store.approvePlan(mission.id, "smoke approval");
store.recordLedger({
  missionID: mission.id,
  provider: "deepseek",
  model: "deepseek-flash",
  variant: "low",
  inputTokens: 1000,
  outputTokens: 100,
  cost: 0.00025,
});

console.log(
  JSON.stringify(
    {
      mission: approved,
      planVersion: submitted.version,
      plan: store.getPlan(mission.id),
      budget: store.budgetSummary(mission.id),
    },
    null,
    2,
  ),
);

db.close();
