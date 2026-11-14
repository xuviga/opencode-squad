import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { Plugin, usePlugin } from "@opencode/plugin/tui";
import type { PanelInput } from "@opencode/plugin/tui/context";
import { SquadRpc } from "./rpc";

type SquadTask = {
  id: string;
  title: string;
  status: string;
  role: string;
  grade: string;
};

type SquadState = {
  mission: {
    id: string;
    title: string;
    status: string;
    planVersion: number;
    expectedCostUsd: number | null;
    actualCostUsd: number;
  } | null;
  tasks: SquadTask[];
  staff: Array<{ id: string; persona: string; grade: string; status: string }>;
  budget: { warnings?: string[]; anomaly?: boolean };
  audits: unknown[];
  disputes: unknown[];
};

export function SquadPanel(props: { panel: PanelInput }) {
  const context = usePlugin();
  const [state, setState] = createSignal<SquadState | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const rpc = () => context.client.rpc(SquadRpc);

  const refresh = async () => {
    try {
      const next = await rpc().state({ mission_id: state()?.mission?.id });
      const payload = (next as { data?: unknown } | null)?.data ?? next;
      setState(payload as SquadState);
      setError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : JSON.stringify(cause);
      console.error("[squad.tui] state error", message);
      setError(message);
    }
  };

  onMount(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 1500);
    onCleanup(() => clearInterval(timer));
  });

  const mission = () => state()?.mission;

  const approve = async () => {
    const id = mission()?.id;
    if (!id) return;
    try {
      await rpc().plan({ mission_id: id, action: "approve" });
      await refresh();
      context.ui.toast.show({ message: "SQUAD plan approved", variant: "success" });
    } catch (cause) {
      context.ui.toast.show({ message: String(cause), variant: "error" });
    }
  };

  const reject = async () => {
    const id = mission()?.id;
    if (!id) return;
    try {
      await rpc().plan({ mission_id: id, action: "reject" });
      await refresh();
      context.ui.toast.show({ message: "SQUAD plan rejected", variant: "warning" });
    } catch (cause) {
      context.ui.toast.show({ message: String(cause), variant: "error" });
    }
  };

  context.keymap.layer(() => ({
    mode: "global",
    priority: 20,
    commands: [
      { id: "squad.panel.approve", bind: "a", title: "Approve SQUAD plan", run: approve },
      { id: "squad.panel.reject", bind: "r", title: "Reject SQUAD plan", run: reject },
      { id: "squad.panel.close", bind: "escape", title: "Close SQUAD panel", run: () => props.panel.close() },
    ],
  }));

  return (
    <box flexDirection="column" padding={1} gap={1}>
      <text fg={context.theme.text.base}>SQUAD</text>
      <Show when={error()}>
        <text fg={context.theme.text.feedback.error.base}>{error()}</text>
      </Show>
      <Show
        when={mission()}
        fallback={<text fg={context.theme.text.muted}>No mission yet. Use /squad in a session.</text>}
      >
        <text fg={context.theme.text.base}>
          {mission()!.title} · {mission()!.status}
        </text>
        <text fg={context.theme.text.muted}>
          plan v{mission()!.planVersion} · cost ${(mission()!.actualCostUsd ?? 0).toFixed(4)}
          {mission()!.expectedCostUsd ? ` / $${mission()!.expectedCostUsd!.toFixed(4)}` : ""}
        </text>
        <text fg={context.theme.text.muted}>
          tasks {state()!.tasks.length} · staff {state()!.staff.length} · audits {state()!.audits.length}
        </text>
        <Show when={state()!.budget.anomaly}>
          <text fg={context.theme.text.feedback.warning.base}>budget anomaly detected</text>
        </Show>
        <For each={state()!.tasks.slice(0, 8)}>
          {(task) => (
            <text fg={context.theme.text.muted}>
              [{task.status}] {task.id} · {task.title}
            </text>
          )}
        </For>
        <text fg={context.theme.text.faint}>a approve · r reject · esc close</text>
      </Show>
    </box>
  );
}

export default Plugin.define({
  id: "squad.tui",
  setup(context) {
    context.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: [
        {
          id: "squad.open",
          title: "Open SQUAD panel",
          group: "SQUAD",
          palette: true,
          slash: { name: "squad" },
          run: () => {
            const opened = context.ui.panel.open("squad.panel");
            if (!opened) {
              context.ui.toast.show({
                message: "Open a session first to use the SQUAD panel",
                variant: "warning",
              });
            }
          },
        },
      ],
    }));

    const disposeSlot = context.ui.slot({
      append: "session.panel",
      render: (panel) => (
        <Show when={panel.name === "squad.panel"}>
          <SquadPanel panel={panel} />
        </Show>
      ),
    });

    return () => {
      disposeSlot();
    };
  },
});
