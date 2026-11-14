import type { Plugin } from "@opencode/plugin";
import { basename, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { Model } from "@opencode/schema/model";
import type { SquadStore } from "../db/store";
import { extractLastAssistantText } from "../runtime/messages";
import { resolveProjectPath, sessionDirectory } from "../runtime/paths";
import { fail, ok } from "./result";

type LookInput = {
  image_path?: string;
  question?: string;
  model?: string;
  mission_id?: string;
  task_id?: string;
  timeout_ms?: number;
};

export async function registerLookTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "look",
      description:
        "Ask a vision-capable model about an image file. Attaches the image to a child session and returns the answer plus cost. DeepSeek Flash accepts image attachments.",
      input: {
        type: "object",
        properties: {
          image_path: { type: "string" },
          question: { type: "string" },
          model: { type: "string" },
          mission_id: { type: "string" },
          task_id: { type: "string" },
          timeout_ms: { type: "number" },
        },
        required: ["image_path"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as LookInput;
        let sessionID: string | undefined;
        try {
          if (!args.image_path) throw new Error("image_path is required");
          const base = await sessionDirectory(ctx, context.sessionID);
          const project = ctx.location.project.canonical;
          const imagePath = resolveProjectPath(base, project, args.image_path);
          if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"].includes(extname(imagePath).toLowerCase())) {
            throw new Error(`unsupported image type: ${extname(imagePath)}`);
          }
          const reference = args.model?.trim() || "deepseek/deepseek-flash#high";
          const model = Model.Ref.parse(reference);

          const session = await ctx.session.create({
            parentID: context.sessionID,
            title: `SQUAD look: ${basename(imagePath)}`,
            agent: "build",
            model,
            location: { directory: base },
          });
          sessionID = session.id;

          await ctx.session.prompt({
            sessionID: session.id,
            text: [
              `You can see the attached image "${basename(imagePath)}".`,
              "Answer the question about the image. Do not use tools, do not edit files, and do not guess if a detail is not visible.",
              "If the image cannot be read, say cannot_see_image.",
              "Question:",
              args.question?.trim() || "Describe what is visible in the image.",
            ].join("\n\n"),
            files: [{ uri: pathToFileURL(imagePath).href, name: basename(imagePath) }],
            delivery: "queue",
          });

          const timeoutMs = Math.max(5_000, Math.min(args.timeout_ms ?? 180_000, 600_000));
          await ctx.session.wait(
            { sessionID: session.id },
            { signal: AbortSignal.timeout(timeoutMs) },
          );

          const messages = await ctx.session.context({ sessionID: session.id });
          const answer = extractLastAssistantText(messages);
          const info = await ctx.session.get({ sessionID: session.id });

          if (args.mission_id) {
            store.recordLedger({
              missionID: args.mission_id,
              taskID: args.task_id ?? null,
              provider: model.providerID,
              model: model.id,
              variant: model.variant ?? null,
              inputTokens: info.tokens.input,
              outputTokens: info.tokens.output,
              cost: info.cost,
            });
          }

          return ok({
            image_path: imagePath,
            model: reference,
            answer,
            cost: info.cost,
            tokens: info.tokens,
          });
        } catch (error) {
          return fail(error);
        } finally {
          if (sessionID) {
            await ctx.session.remove({ sessionID }).catch(() => undefined);
          }
        }
      },
    });
  });
}
