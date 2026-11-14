import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const endpoint = await Service.ensure();
const client = OpenCode.make({
  baseUrl: endpoint.url,
  headers: Service.headers(endpoint),
});

for (const id of [
  "ses_e2632f6d1ffe6qKv16CrjdynMy",
  "ses_e2632f6bdffed9SG9yd99VOTUZ",
  "ses_e2632f6c4ffeHtNOj8VNZfVJSV",
]) {
  const info = await client.session.get({ sessionID: id });
  console.log(
    JSON.stringify(
      {
        id: info.id,
        title: info.title,
        parentID: info.parentID,
        location: info.location,
        directory: (info as Record<string, unknown>).directory,
      },
      null,
      2,
    ),
  );
}
