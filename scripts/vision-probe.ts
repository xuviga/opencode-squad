import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";
import { pathToFileURL } from "node:url";

const endpoint = await Service.ensure();
const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });
const directory = "D:/codex/opencode-squad/dev";
const png = "D:/codex/opencode-squad/dev/design/squad-poster.png";

const session = await client.session.create({
  title: "SQUAD vision probe",
  location: { directory },
  model: { providerID: "deepseek", id: "deepseek-flash", variant: "high" },
});

try {
  await client.session.prompt({
    sessionID: session.id,
    text: "Look at the attached image. Answer in one JSON object: {largest_word, accent_color_hex_if_visible, ledger_rows, footer_text}. If you cannot see the image, say cannot_see_image.",
    files: [{ uri: pathToFileURL(png).href, name: "squad-poster.png" }],
  });
  await client.session.wait({ sessionID: session.id }, { signal: AbortSignal.timeout(180000) });
  const messages = await client.session.context({ sessionID: session.id });
  const parts: string[] = [];
  for (const message of messages as Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>) {
    if (message.type !== "assistant" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type === "text" && part.text) parts.push(part.text);
    }
  }
  const info = await client.session.get({ sessionID: session.id });
  console.log(JSON.stringify({ answer: parts.join("\n").slice(-4000), cost: info.cost, tokens: info.tokens }, null, 2));
} finally {
  await client.session.remove({ sessionID: session.id }).catch(() => undefined);
}
