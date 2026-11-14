import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";

const db = openSquadDb("D:/codex/opencode-squad/dev");
const store = new SquadStore(db);

const mission = store.createMission(
  "TUI live gate",
  "Exercise the SQUAD panel reject and approve keys under a real TTY.",
);
store.submitPlan(mission.id, {
  goal: "Exercise the SQUAD panel reject and approve keys under a real TTY.",
  tasks: [
    {
      id: "tui_task",
      title: "Panel gate task",
      class: "code",
      role: "implementer",
      grade: "G2",
      acceptance: ["The panel can reject and approve this plan"],
    },
  ],
});

console.log(mission.id);
db.close();
