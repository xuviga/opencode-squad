import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSquadDb } from "../src/db/index";
import { SquadStore } from "../src/db/store";
import { taskImages } from "../src/runtime/images";
import { renderSvgPreview } from "../src/runtime/preview";

let directory: string;
let db: ReturnType<typeof openSquadDb>;
let store: SquadStore;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "squad-preview-"));
  db = openSquadDb(join(directory, "db"));
  store = new SquadStore(db);
});

afterEach(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("preview", () => {
  test("renders an SVG to a PNG with the requested width", () => {
    const svg = join(directory, "test.svg");
    const png = join(directory, "out", "test.png");
    writeFileSync(
      svg,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="#E0361A"/><text x="10" y="30">SQUAD</text></svg>',
    );
    const result = renderSvgPreview(svg, png, 200);
    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
    expect(result.bytes).toBeGreaterThan(0);
    expect(existsSync(png)).toBe(true);
    const signature = readFileSync(png).subarray(0, 4);
    expect([...signature]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  test("taskImages auto-renders an SVG preview for a design task", () => {
    const svg = join(directory, "poster.svg");
    writeFileSync(
      svg,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>',
    );
    const mission = store.createMission("Preview", "Preview");
    store.submitPlan(mission.id, {
      goal: "Preview",
      tasks: [
        {
          id: "d1",
          title: "Poster",
          class: "design",
          role: "designer",
          grade: "G2",
          acceptance: ["done"],
        },
      ],
    });
    store.approvePlan(mission.id);
    const staff = store.hireStaff({
      persona: "designer",
      grade: "G2",
      agent: "build",
      provider: "deepseek",
      model: "deepseek-flash",
      variant: "high",
      sessionID: "ses_designer",
      worktreeDirectory: directory,
    });
    store.assignTask(mission.id, "d1", staff.id, { goal: "poster" });
    store.markTaskRunning(mission.id, "d1");
    store.saveRawReport(mission.id, "d1", "{}");
    const submitted = store.requireTask(mission.id, "d1");

    const images = taskImages({ location: { directory } } as never, store, submitted, {
      data: [{ file: "poster.svg" }],
    });
    expect(images).toHaveLength(1);
    expect(images[0]?.name).toBe("d1-preview.png");
    expect(existsSync(images[0]!.path)).toBe(true);
  });
});
