import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const sessionID = process.argv[2];
if (!sessionID) {
  console.error("usage: bun run scripts/session-inspect.ts <session_id>");
  process.exit(1);
}

const endpoint = await Service.ensure();
const client = OpenCode.make({
  baseUrl: endpoint.url,
  headers: Service.headers(endpoint),
});

const info = await client.session.get({ sessionID });
const messages = await client.session.context({ sessionID });

function extractAssistantText(items: readonly unknown[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const record = item as { type?: string; content?: unknown };
    if (record.type !== "assistant" || !Array.isArray(record.content)) continue;
    for (const part of record.content) {
      if (!part || typeof part !== "object") continue;
      const content = part as { type?: string; text?: unknown };
      if (content.type === "text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

console.log(
  JSON.stringify(
    {
      info: {
        id: info.id,
        parentID: info.parentID,
        title: info.title,
        agent: info.agent,
        model: info.model,
        outcome: info.outcome,
        cost: info.cost,
        tokens: info.tokens,
        time: info.time,
      },
      messageCount: messages.length,
      messageTypes: messages.map((message) =>
        message && typeof message === "object"
          ? (message as { type?: string }).type ?? "unknown"
          : "unknown",
      ),
      assistantText: extractAssistantText(messages),
    },
    null,
    2,
  ),
);
