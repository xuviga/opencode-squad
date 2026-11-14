import { describe, expect, mock, test } from "bun:test";

type Layer = {
  commands: Array<{ id: string; slash?: { name: string }; run: () => unknown }>;
};

const layers: Layer[] = [];
const slots: Array<{ append?: string; render: unknown }> = [];
let opened: string | null = null;
let toast: string | null = null;

const fakeContext = {
  keymap: {
    layer: (factory: () => Layer) => {
      layers.push(factory());
      return () => undefined;
    },
  },
  ui: {
    slot: (claim: { append?: string; render: unknown }) => {
      slots.push(claim);
      return () => undefined;
    },
    panel: {
      open: (name: string) => {
        opened = name;
        return true;
      },
    },
    toast: {
      show: (input: { message: string }) => {
        toast = input.message;
      },
    },
  },
};

mock.module("@opencode/plugin/tui", () => ({
  Plugin: { define: (definition: unknown) => definition },
  usePlugin: () => fakeContext,
}));

const { default: tui } = await import("../src/tui");

describe("squad TUI plugin", () => {
  test("registers /squad, claims the session panel and opens it", async () => {
    const cleanup = await tui.setup(fakeContext as never);

    const global = layers.find((layer) =>
      layer.commands.some((command) => command.id === "squad.open"),
    );
    expect(global).toBeDefined();
    const open = global!.commands.find((command) => command.id === "squad.open")!;
    expect(open.slash?.name).toBe("squad");

    open.run();
    expect(opened).toBe("squad.panel");
    expect(toast).toBeNull();

    expect(slots).toHaveLength(1);
    expect(slots[0]?.append).toBe("session.panel");
    expect(typeof slots[0]?.render).toBe("function");

    await cleanup?.();
  });
});
