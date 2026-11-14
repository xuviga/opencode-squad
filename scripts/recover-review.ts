import { fileURLToPath } from "node:url";
import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";
import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";

const [missionID, taskID, reviewerSessionID] = process.argv.slice(2);
if (!missionID || !taskID || !reviewerSessionID) {
  console.error("usage: bun run scripts/recover-review.ts <mission_id> <task_id> <reviewer_session_id>");
  process.exit(1);
}

const directory = fileURLToPath(new URL("../dev", import.meta.url));
const db = openSquadDb(directory);
const store = new SquadStore(db);
const task = store.requireTask(missionID, taskID);
const staff = task.reviewerStaffID ? store.getStaff(task.reviewerStaffID) : undefined;

const endpoint = await Service.ensure();
const client = OpenCode.make({
  baseUrl: endpoint.url,
  headers: Service.headers(endpoint),
});

let info:
  | Awaited<ReturnType<typeof client.session.get>>
  | undefined;
try {
  info = await client.session.get({ sessionID: reviewerSessionID });
} catch {
  info = undefined;
}

if (info && !store.hasLedgerEntry(missionID, taskID, reviewerSessionID)) {
  store.recordLedger({
    missionID,
    taskID,
    staffID: task.reviewerStaffID,
    sessionID: reviewerSessionID,
    provider: staff?.provider,
    model: staff?.model,
    variant: staff?.variant,
    inputTokens: info.tokens.input,
    outputTokens: info.tokens.output,
    cost: info.cost,
  });
}

await client.session.interrupt({ sessionID: reviewerSessionID, resume: false }).catch(() => undefined);
await client.session.remove({ sessionID: reviewerSessionID }).catch(() => undefined);
const reset = store.resetReview(missionID, taskID, "manual recovery");

console.log(
  JSON.stringify(
    {
      interrupted: reviewerSessionID,
      reviewer_cost: info?.cost ?? null,
      reviewer_tokens: info?.tokens ?? null,
      task: reset,
      budget: store.budgetSummary(missionID),
    },
    null,
    2,
  ),
);

db.close();
