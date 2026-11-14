import type { Plugin } from "@opencode/plugin";
import { existsSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SquadStore, Task } from "../db/store";
import { renderSvgPreview } from "./preview";

export type ImageAttachment = {
  uri: string;
  name: string;
  path: string;
};

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;
const SVG_EXT = /\.svg$/i;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function diffFiles(diff: unknown): string[] {
  const data = (diff as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => (entry as { file?: unknown }).file)
    .filter((file): file is string => typeof file === "string");
}

/**
 * Collects raster images referenced by the worker report and, for design
 * tasks without one, renders an SVG preview so a blind reviewer can see it.
 */
export function taskImages(
  ctx: Plugin.Context,
  store: SquadStore,
  task: Task,
  diff: unknown,
): ImageAttachment[] {
  const staff = task.staffID ? store.getStaff(task.staffID) : undefined;
  const base = staff?.worktreeDirectory ?? ctx.location.directory;
  const project = ctx.location.project?.canonical ?? ctx.location.directory;
  const report = task.report as
    | { artifacts?: { images?: unknown; files?: unknown } }
    | undefined;
  const files = [...strings(report?.artifacts?.images), ...strings(report?.artifacts?.files)];

  const attachments: ImageAttachment[] = [];
  const seen = new Set<string>();

  const push = (path: string) => {
    const key = path.toLowerCase();
    if (seen.has(key) || !existsSync(path)) return;
    seen.add(key);
    attachments.push({
      uri: pathToFileURL(path).href,
      name: basename(path),
      path,
    });
  };

  for (const file of files) {
    if (!IMAGE_EXT.test(file)) continue;
    const primary = isAbsolute(file) ? file : resolve(base, file);
    push(primary);
    if (!isAbsolute(file)) push(resolve(project, file));
  }

  if (attachments.length === 0 && task.class === "design") {
    const svgCandidates = [
      ...files.filter((file) => SVG_EXT.test(file)),
      ...diffFiles(diff).filter((file) => SVG_EXT.test(file)),
    ];
    for (const file of svgCandidates) {
      const svgPath = isAbsolute(file) ? file : resolve(base, file);
      if (!existsSync(svgPath)) continue;
      const outPath = resolve(base, ".squad", "artifacts", `${task.id}-preview.png`);
      try {
        renderSvgPreview(svgPath, outPath, 1200);
        push(outPath);
      } catch {
        // leave the review text-only when the SVG cannot be rendered
      }
      break;
    }
  }

  return attachments.slice(0, 3);
}
