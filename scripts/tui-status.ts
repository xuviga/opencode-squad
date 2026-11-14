import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";

const missionID = process.argv[2];
if (!missionID) throw new Error("missionID is required");

const db = openSquadDb("D:/codex/opencode-squad/dev");
const store = new SquadStore(db);
console.log(store.requireMission(missionID).status);
db.close();
