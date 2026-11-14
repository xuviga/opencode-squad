import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const sessionID = process.argv[2];
if (!sessionID) throw new Error("sessionID argument is required");

const endpoint = await Service.ensure();
const client = OpenCode.make({
  baseUrl: endpoint.url,
  headers: Service.headers(endpoint),
});

console.log(`holding ${sessionID} with a 600s shell`);
await client.session.shell({
  sessionID,
  command: "Start-Sleep -Seconds 600",
});
console.log("shell finished");
