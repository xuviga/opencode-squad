import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureSnapshot, formatDiffForPrompt, snapshotDiff } from "../src/runtime/snapshot";

let root: string;
let project: string;
let snapshot: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "squad-snapshot-"));
  project = join(root, "project");
  snapshot = join(root, "snapshot");
  mkdirSync(project);
  writeFileSync(join(project, "a.txt"), "one\ntwo\n", "utf8");
  writeFileSync(join(project, "keep.txt"), "same\n", "utf8");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("snapshot diff", () => {  test("detects added, modified and deleted files", () => {
    captureSnapshot(project, snapshot);

    writeFileSync(join(project, "a.txt"), "one\ntwo\nthree\n", "utf8");
    writeFileSync(join(project, "b.txt"), "new file\n", "utf8");
    unlinkSync(join(project, "keep.txt"));

    const diff = snapshotDiff(snapshot, project);
    const byFile = new Map(diff.data.map((item) => [item.file, item]));

    expect(byFile.get("a.txt")?.status).toBe("modified");
    expect(byFile.get("a.txt")?.patch).toContain("+ three");
    expect(byFile.get("b.txt")?.status).toBe("added");
    expect(byFile.get("b.txt")?.patch).toContain("+ new file");
    expect(byFile.get("keep.txt")?.status).toBe("deleted");
    expect(byFile.get("keep.txt")?.patch).toContain("- same");
  });

  test("reports no changes for an untouched folder", () => {
    captureSnapshot(project, snapshot);
    expect(snapshotDiff(snapshot, project).data).toEqual([]);
  });

  test("skips ignored directories", () => {
    mkdirSync(join(project, "node_modules"));
    writeFileSync(join(project, "node_modules", "dep.js"), "module\n", "utf8");
    const manifest = captureSnapshot(project, snapshot);
    expect(Object.keys(manifest.entries)).not.toContain("node_modules/dep.js");
  });

  test("keeps binary files out of the patch text", () => {
    captureSnapshot(project, snapshot);
    writeFileSync(join(project, "blob.bin"), Buffer.from([0, 1, 2, 3]));
    const diff = snapshotDiff(snapshot, project);
    const blob = diff.data.find((item) => item.file === "blob.bin");
    expect(blob?.status).toBe("binary");
    expect(blob?.patch).toContain("binary");
  });

  test("lists every changed file even when the patch budget is exhausted", () => {
    mkdirSync(join(project, "scripts"));
    const lines = Array.from({ length: 600 }, (_, index) => `line ${index}`).join("\n");
    const names: string[] = [];
    for (let index = 0; index < 30; index += 1) {
      const name = `scripts/f${String(index).padStart(2, "0")}.txt`;
      writeFileSync(join(project, name), `${lines}\n`, "utf8");
      names.push(name);
    }
    captureSnapshot(project, snapshot);

    for (const name of names) {
      writeFileSync(join(project, name), `${lines}\nchanged\n`, "utf8");
    }

    const diff = snapshotDiff(snapshot, project);
    const listed = new Set(diff.data.map((item) => item.file));
    for (const name of names) expect(listed.has(name)).toBe(true);
    expect(diff.data.length).toBeGreaterThanOrEqual(names.length);
    expect(diff.truncated).toBe(true);
    expect(diff.trimmedFiles.length).toBeGreaterThan(0);
    const trimmed = diff.data.find((item) => item.patch === "");
    expect(trimmed).toBeDefined();
  });

  test("formatter keeps every file header under a small prompt budget", () => {
    const text = formatDiffForPrompt(
      {
        data: [
          { file: "a.txt", status: "modified", patch: "x".repeat(2000) },
          { file: "scripts/zzz.txt", status: "added", patch: "y".repeat(2000) },
        ],
      },
      600,
    );
    expect(text).toContain("### a.txt");
    expect(text).toContain("### scripts/zzz.txt");
    expect(text).toContain("partial patches");
  });
});
