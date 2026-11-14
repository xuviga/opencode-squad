import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const endpoint = await Service.ensure();
const client = OpenCode.make({
  baseUrl: endpoint.url,
  headers: Service.headers(endpoint),
});

const directory = "D:/codex/opencode-squad/dev";
const worktree =
  "C:/Users/XuViGaN/.local/share/opencode/worktree/5cec9b/squad-implementer-43f184";

const parent = await client.session.create({ title: "isolation parent 2", location: { directory } });
const child = await client.session.create({
  title: "isolation child moved",
  parentID: parent.id,
  location: { directory: worktree },
});
console.log("child initial", (await client.session.get({ sessionID: child.id })).location.directory);

await client.session.move({ sessionID: child.id, directory: worktree });
for (let attempt = 0; attempt < 20; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const info = await client.session.get({ sessionID: child.id });
  console.log("child poll", attempt, info.location.directory);
  if (info.location.directory === worktree) break;
}

for (const id of [child.id, parent.id]) {
  await client.session.remove({ sessionID: id }).catch(() => undefined);
}
