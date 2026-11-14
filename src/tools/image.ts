import type { Plugin } from "@opencode/plugin";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Model } from "@opencode/schema/model";
import type { SquadStore } from "../db/store";
import { fail, ok } from "./result";

type ImageInput = {
  prompt?: string;
  model?: string;
  aspect?: string;
  resolution?: string;
  n?: number;
  out_dir?: string;
  name?: string;
  mission_id?: string;
  task_id?: string;
};

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function extensionFor(mime: string): string {
  return MIME_EXTENSIONS[mime.toLowerCase()] ?? "png";
}

function sanitizeName(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "image";
}

function decodeBase64(data: string): Buffer {
  const comma = data.indexOf(",");
  const payload = data.startsWith("data:") && comma >= 0 ? data.slice(comma + 1) : data;
  return Buffer.from(payload, "base64");
}

type ModelEntry = {
  id: string;
  providerID: string;
  name?: string;
  type?: string;
};

async function pickImageModel(ctx: Plugin.Context): Promise<string> {
  const result = await ctx.model.list();
  const models = (result?.data ?? []) as ModelEntry[];
  const image = models.find((model) => model.type === "image");
  if (!image) {
    throw new Error(
      "no image model is configured; pass model as provider/model (see available image models)",
    );
  }
  return `${image.providerID}/${image.id}`;
}

export async function registerImageTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "image",
      description:
        "Generate an image with the experimental.generate.image API, write the files under .squad/artifacts, and optionally record the cost in the mission ledger. Use for design and creative tasks.",
      input: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          model: { type: "string" },
          aspect: { type: "string" },
          resolution: { type: "string" },
          n: { type: "integer", minimum: 1, maximum: 4 },
          out_dir: { type: "string" },
          name: { type: "string" },
          mission_id: { type: "string" },
          task_id: { type: "string" },
        },
        required: ["prompt"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input) => {
        const args = (input ?? {}) as ImageInput;
        try {
          if (!args.prompt) throw new Error("prompt is required");
          const reference = args.model?.trim() || (await pickImageModel(ctx));
          const model = Model.Ref.parse(reference);

          const result = await ctx.experimental.generate.image({
            model,
            prompt: args.prompt,
            ...(args.n ? { n: args.n } : {}),
            ...(args.aspect ? { aspect: args.aspect as `${number}:${number}` } : {}),
            ...(args.resolution ? { resolution: args.resolution } : {}),
          });

          const outDir = resolve(
            ctx.location.directory,
            args.out_dir?.trim() || ".squad/artifacts",
          );
          await mkdir(outDir, { recursive: true });

          const baseName = sanitizeName(args.name ?? `image-${Date.now()}`);
          const files: Array<{ path: string; mime: string; bytes: number }> = [];
          const images = result.images ?? [];
          for (const [index, image] of images.entries()) {
            const extension = extensionFor(image.mime);
            const filePath = join(outDir, `${baseName}-${index + 1}.${extension}`);
            const bytes = decodeBase64(image.data);
            await writeFile(filePath, bytes);
            files.push({ path: filePath, mime: image.mime, bytes: bytes.byteLength });
          }

          const cost = Number(result.cost ?? 0);
          if (args.mission_id && cost > 0) {
            store.recordLedger({
              missionID: args.mission_id,
              taskID: args.task_id ?? null,
              provider: model.providerID,
              model: model.id,
              variant: model.variant ?? null,
              inputTokens: result.tokens?.input ?? 0,
              outputTokens: result.tokens?.output ?? 0,
              cost,
            });
          }

          return ok({
            model: reference,
            files,
            images: images.length,
            cost,
            tokens: result.tokens ?? null,
            out_dir: outDir,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
