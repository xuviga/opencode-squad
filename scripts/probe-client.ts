import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

type AssistantMessage = {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
};

function extractAssistantText(messages: readonly unknown[]): string {
  const parts: string[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const record = message as AssistantMessage;
    if (record.type !== "assistant" || !Array.isArray(record.content)) continue;
    for (const part of record.content) {
      if (part?.type === "text" && typeof part.text === "string") {
        parts.push(part.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

const keep = process.argv.includes("--keep");
const startedAt = new Date().toISOString();
const steps: Array<{ step: string; at: string; detail?: unknown }> = [];

let rootSessionID: string | undefined;
let childSessionID: string | undefined;

try {
  steps.push({ step: "discover-service", at: new Date().toISOString() });
  const endpoint = await Service.ensure();
  const client = OpenCode.make({
    baseUrl: endpoint.url,
    headers: Service.headers(endpoint),
  });

  steps.push({ step: "create-root", at: new Date().toISOString(), detail: endpoint.url });
  const root = await client.session.create({
    title: "SQUAD probe root",
    location: { directory: process.cwd() },
  });
  rootSessionID = root.id;

  steps.push({ step: "create-child", at: new Date().toISOString() });
  const child = await client.session.create({
    parentID: root.id,
    title: "SQUAD probe child",
    agent: "explore",
    model: { id: "deepseek-flash", providerID: "deepseek", variant: "low" },
    location: { directory: process.cwd() },
    permissions: [
      { action: "edit", resource: "*", effect: "deny" },
      { action: "shell", resource: "*", effect: "deny" },
      { action: "subagent", resource: "*", effect: "deny" },
    ],
  });
  childSessionID = child.id;

  steps.push({ step: "prompt", at: new Date().toISOString() });
  await client.session.prompt({
    sessionID: child.id,
    text: "Reply with exactly: SQUAD_PROBE_OK",
    delivery: "queue",
  });

  steps.push({ step: "wait", at: new Date().toISOString() });
  await client.session.wait({ sessionID: child.id }, { signal: AbortSignal.timeout(180_000) });

  steps.push({ step: "context", at: new Date().toISOString() });
  const messages = await client.session.context({ sessionID: child.id });

  steps.push({ step: "session-info", at: new Date().toISOString() });
  const info = await client.session.get({ sessionID: child.id });

  steps.push({ step: "diff", at: new Date().toISOString() });
  let diff: unknown;
  try {
    diff = await client.session.diff({ sessionID: child.id });
  } catch (error) {
    diff = { error: errorMessage(error) };
  }

  steps.push({ step: "interrupt", at: new Date().toISOString() });
  const interrupt = await client.session.interrupt({ sessionID: child.id, resume: false });

  const assistantText = extractAssistantText(messages);
  const result = {
    ok: assistantText.length > 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    rootSessionID,
    childSessionID,
    assistantText,
    messageCount: messages.length,
    cost: info.cost,
    tokens: info.tokens,
    interrupt,
    diff,
    steps,
  };

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        startedAt,
        finishedAt: new Date().toISOString(),
        rootSessionID,
        childSessionID,
        error: errorMessage(error),
        steps,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  if (!keep && rootSessionID) {
    try {
      const endpoint = await Service.ensure();
      const client = OpenCode.make({
        baseUrl: endpoint.url,
        headers: Service.headers(endpoint),
      });
      await client.session.remove({ sessionID: rootSessionID });
    } catch {
      // cleanup is best-effort
    }
  }
}
