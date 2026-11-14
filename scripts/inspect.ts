import { fileURLToPath } from "node:url";
import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";

const missionID = process.argv[2];
if (!missionID) {
  console.error("usage: bun run scripts/inspect.ts <mission_id>");
  process.exit(1);
}

const directory = fileURLToPath(new URL("../dev", import.meta.url));
const db = openSquadDb(directory);
const store = new SquadStore(db);

console.log(
  JSON.stringify(
    {
      mission: store.requireMission(missionID),
      plan: store.getPlan(missionID),
      tasks: store.listTasks(missionID),
      budget: store.budgetSummary(missionID),
      staff: store.listStaff(20),
    },
    null,
    2,
  ),
);

db.close();
