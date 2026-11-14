import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";
import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";

const directory = "D:/codex/opencode-squad/dev";
const db = openSquadDb(directory);
const store = new SquadStore(db);

const mission = store.createMission(
  "Timeout fixture",
  "Prove squad_wait times out on a busy worker and the task can be recovered.",
);
store.submitPlan(mission.id, {
  goal: "Prove squad_wait times out on a busy worker and the task can be recovered.",
  tasks: [
    {
      id: "timeout_task",
      title: "Write dev/stuck/timeout.txt",
      class: "code",
      role: "implementer",
      grade: "G2",
      acceptance: [
        "dev/stuck/timeout.txt exists and contains exactly TIMEOUT_OK",
        "The change is committed in the worktree",
      ],
    },
  ],
});
store.approvePlan(mission.id);

const endpoint = await Service.ensure();
const client = OpenCode.make({
  baseUrl: endpoint.url,
  headers: Service.headers(endpoint),
});

const session = await client.session.create({
  title: "stuck worker fixture",
  location: { directory },
});

const staff = store.hireStaff({
  persona: "implementer",
  grade: "G2",
  agent: "build",
  provider: "deepseek",
  model: "deepseek-flash",
  variant: "high",
  sessionID: session.id,
  worktreeDirectory: null,
});

store.assignTask(mission.id, "timeout_task", staff.id, {
  task_id: "timeout_task",
  mission_id: mission.id,
  goal: "Block until the shell finishes",
  note: "fixture for squad_wait timeout",
});
store.markTaskRunning(mission.id, "timeout_task");

await client.session.shell({
  sessionID: session.id,
  command: "Start-Sleep -Seconds 600",
});

console.log(
  JSON.stringify(
    { missionID: mission.id, taskID: "timeout_task", staffID: staff.id, sessionID: session.id },
    null,
    2,
  ),
);
db.close();
