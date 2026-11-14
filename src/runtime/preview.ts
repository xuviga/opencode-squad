import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Resvg } from "@resvg/resvg-js";

export type PreviewResult = {
  path: string;
  width: number;
  height: number;
  bytes: number;
};

export function renderSvgPreview(svgPath: string, outPath: string, width = 1200): PreviewResult {
  const svg = readFileSync(svgPath, "utf8");
  const renderer = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  const image = renderer.render();
  const png = image.asPng();
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  return {
    path: outPath,
    width: image.width,
    height: image.height,
    bytes: png.byteLength,
  };
}
