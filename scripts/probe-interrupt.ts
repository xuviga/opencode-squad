import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const endpoint = await Service.ensure();
const client = OpenCode.make({
  baseUrl: endpoint.url,
  headers: Service.headers(endpoint),
});

let rootID: string | undefined;
let childID: string | undefined;

try {
  const root = await client.session.create({
    title: "SQUAD interrupt probe root",
    location: { directory: process.cwd() },
  });
  rootID = root.id;

  const child = await client.session.create({
    parentID: root.id,
    title: "SQUAD interrupt probe child",
    agent: "explore",
    model: { id: "deepseek-flash", providerID: "deepseek", variant: "low" },
    location: { directory: process.cwd() },
    permissions: [
      { action: "edit", resource: "*", effect: "deny" },
      { action: "shell", resource: "*", effect: "deny" },
      { action: "subagent", resource: "*", effect: "deny" },
    ],
  });
  childID = child.id;

  await client.session.prompt({
    sessionID: child.id,
    text: "Write a very long, detailed 5000-word essay about the history of the Roman Empire. Do not stop early and do not summarize.",
    delivery: "queue",
  });

  await new Promise((resolve) => setTimeout(resolve, 1200));
  const interrupt = await client.session.interrupt({ sessionID: child.id, resume: false });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const info = await client.session.get({ sessionID: child.id });
  const messages = await client.session.context({ sessionID: child.id });

  console.log(
    JSON.stringify(
      {
        ok: interrupt.interrupted === true,
        rootSessionID: root.id,
        childSessionID: child.id,
        interrupt,
        outcome: info.outcome,
        cost: info.cost,
        tokens: info.tokens,
        messageCount: messages.length,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        rootSessionID: rootID,
        childSessionID: childID,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  if (rootID) {
    try {
      await client.session.remove({ sessionID: rootID });
    } catch {
      // best-effort cleanup
    }
  }
}
