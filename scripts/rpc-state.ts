import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";
import { SquadRpc } from "../src/rpc";

const endpoint = await Service.ensure();
const client = OpenCode.make({
  baseUrl: endpoint.url,
  headers: Service.headers(endpoint),
});
const directory = "D:/codex/opencode-squad/dev";

const session = await client.session.create({
  title: "SQUAD RPC probe",
  location: { directory },
});

try {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const squad = client.rpc(SquadRpc);
  const state = await squad.state({}, { location: { directory } });
  console.log(JSON.stringify(state, null, 2).slice(0, 4000));
} finally {
  await client.session.remove({ sessionID: session.id }).catch(() => undefined);
}
