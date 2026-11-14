import type { Plugin } from "@opencode/plugin";
import { basename, extname, resolve } from "node:path";
import { renderSvgPreview } from "../runtime/preview";
import { resolveProjectPath, sessionDirectory } from "../runtime/paths";
import { fail, ok } from "./result";

type PreviewInput = {
  svg_path?: string;
  out_path?: string;
  width?: number;
};

export async function registerPreviewTool(ctx: Plugin.Context) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "preview",
      description:
        "Rasterize an SVG to PNG so the agent or a reviewer can actually see it. Writes under .squad/artifacts by default and returns the absolute path, width and height.",
      input: {
        type: "object",
        properties: {
          svg_path: { type: "string" },
          out_path: { type: "string" },
          width: { type: "integer", minimum: 64, maximum: 8192 },
        },
        required: ["svg_path"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as PreviewInput;
        try {
          if (!args.svg_path) throw new Error("svg_path is required");
          const base = await sessionDirectory(ctx, context.sessionID);
          const project = ctx.location.project.canonical;
          const svgPath = resolveProjectPath(base, project, args.svg_path);
          const name = basename(svgPath, extname(svgPath));
          const outPath = args.out_path
            ? resolveProjectPath(base, project, args.out_path)
            : resolve(base, ".squad", "artifacts", `${name}.png`);
          const preview = renderSvgPreview(svgPath, outPath, args.width ?? 1200);
          return ok({ svg_path: svgPath, ...preview });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
