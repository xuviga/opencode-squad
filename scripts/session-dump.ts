import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const sessionID = process.argv[2];
if (!sessionID) {
  console.error("usage: bun run scripts/session-dump.ts <session_id>");
  process.exit(1);
}

const endpoint = await Service.ensure();
const client = OpenCode.make({
  baseUrl: endpoint.url,
  headers: Service.headers(endpoint),
});
const messages = await client.session.context({ sessionID });

const summary = messages.map((message) => {
  const record = message as {
    id?: string;
    type?: string;
    content?: Array<{
      type?: string;
      name?: string;
      text?: string;
      state?: { status?: string; error?: { message?: string } };
    }>;
  };
  return {
    id: record.id,
    type: record.type,
    parts: Array.isArray(record.content)
      ? record.content.map((part) => ({
          type: part.type,
          name: part.name,
          status: part.state?.status,
          error: part.state?.error?.message,
          textLength: typeof part.text === "string" ? part.text.length : undefined,
          textTail:
            typeof part.text === "string" ? part.text.slice(-300) : undefined,
        }))
      : undefined,
  };
});

console.log(JSON.stringify(summary, null, 2));
