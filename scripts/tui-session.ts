import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const endpoint = await Service.ensure();
const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });
const session = await client.session.create({
  title: "SQUAD TUI live",
  location: { directory: "D:/codex/opencode-squad/dev" },
});
console.log(session.id);
