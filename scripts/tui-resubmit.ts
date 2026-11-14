import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";

const missionID = process.argv[2];
if (!missionID) throw new Error("missionID is required");

const db = openSquadDb("D:/codex/opencode-squad/dev");
const store = new SquadStore(db);
const plan = store.getPlan(missionID);
if (!plan) throw new Error(`no plan for ${missionID}`);
const result = store.submitPlan(missionID, plan);
console.log(JSON.stringify({ mission: result.mission.status, version: result.version }));
db.close();
