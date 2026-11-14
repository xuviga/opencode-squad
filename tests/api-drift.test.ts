import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXPECTED_TOOLS = [
  "squad.status",
  "squad.probe",
  "squad.mission",
  "squad.plan",
  "squad.template",
  "squad.capabilities",
  "squad.image",
  "squad.preview",
  "squad.look",
  "squad.cancel",
  "squad.budget",
  "squad.hire",
  "squad.staff",
  "squad.assign",
  "squad.wait",
  "squad.check",
  "squad.review",
  "squad.verdict",
  "squad.report",
  "squad.appraise",
  "squad.fire",
  "squad.scorecard",
  "squad.career",
  "squad.tasks",
  "squad.finalize",
  "squad.gc",
  "squad.dispute",
  "squad.audit",
  "squad.integrate",
];

describe("API drift", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "squad-drift-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  test("OpenCode packages are pinned to 2.3.0", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@opencode/plugin"]).toBe("2.3.0");
    expect(pkg.devDependencies["@opencode/client"]).toBe("2.3.0");
    expect(pkg.devDependencies["@opencode/schema"]).toBe("2.3.0");
    expect(pkg.devDependencies["@opencode/theme"]).toBe("2.3.0");
  });

  test("setup registers the full squad tool surface", async () => {
    const registered: string[] = [];
    const fakeCtx = {
      app: { version: "2.3.0" },
      location: { directory, project: { id: "test-project" } },
      tool: {
        transform: async (factory: (editor: unknown) => unknown) => {
          factory({
            namespace: () => undefined,
            add: (tool: { name: string; options?: { namespace?: string } }) => {
              registered.push(`${tool.options?.namespace ?? "squad"}.${tool.name}`);
            },
          });
          return { dispose: async () => undefined };
        },
      },
      rpc: {
        register: async () => ({ dispose: async () => undefined }),
      },
    };

    const plugin = (await import("../src/index")).default;
    const cleanup = await plugin.setup(fakeCtx as never);
    try {
      expect(new Set(registered)).toEqual(new Set(EXPECTED_TOOLS));
    } finally {
      await cleanup?.();
    }
  });
});
