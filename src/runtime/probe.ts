import type { Plugin } from "@opencode/plugin";
import { extractLastAssistantText } from "./messages";

export type ProbeOptions = {
  prompt?: string;
  agent?: string;
  providerID?: string;
  modelID?: string;
  variant?: string;
  timeoutMs?: number;
  keep?: boolean;
};

export type ProbeStep = {
  step: string;
  at: string;
  detail?: unknown;
};

export type ProbeResult = {
  ok: boolean;
  parentSessionID: string;
  childSessionID?: string;
  assistantText?: string;
  messageCount?: number;
  cost?: number;
  tokens?: unknown;
  interrupt?: unknown;
  diff?: unknown;
  error?: string;
  steps: ProbeStep[];
};

const DEFAULT_TIMEOUT_MS = 120_000;

function now(): string {
  return new Date().toISOString();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * M0.0 capability probe.
 *
 * Creates a child session under `parentSessionID`, sends one prompt, waits for
 * idle, reads context/session info, asks for the working-tree diff, and
 * interrupts the child. The child is removed unless `keep` is true.
 */
export async function runSessionProbe(
  ctx: Plugin.Context,
  parentSessionID: string,
  options: ProbeOptions = {},
): Promise<ProbeResult> {
  const steps: ProbeStep[] = [];
  const timeoutMs = Math.max(5_000, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 600_000));
  const agent = options.agent ?? "explore";
  const providerID = options.providerID ?? "deepseek";
  const modelID = options.modelID ?? "deepseek-flash";
  const variant = options.variant ?? "low";
  const prompt = options.prompt ?? "Reply with exactly: SQUAD_PROBE_OK";
  const keep = options.keep === true;

  const result: ProbeResult = {
    ok: false,
    parentSessionID,
    steps,
  };

  let childSessionID: string | undefined;

  try {
    steps.push({ step: "create-child", at: now(), detail: { agent, providerID, modelID, variant } });
    const child = await ctx.session.create({
      parentID: parentSessionID,
      title: "SQUAD probe child",
      agent,
      model: { id: modelID, providerID, variant },
      location: { directory: ctx.location.directory },
      permissions: [
        { action: "edit", resource: "*", effect: "deny" },
        { action: "shell", resource: "*", effect: "deny" },
        { action: "subagent", resource: "*", effect: "deny" },
      ],
    });

    childSessionID = child.id;
    result.childSessionID = child.id;
    steps.push({ step: "child-created", at: now(), detail: { sessionID: child.id } });

    steps.push({ step: "prompt", at: now(), detail: { prompt } });
    await ctx.session.prompt({ sessionID: child.id, text: prompt, delivery: "queue" });

    steps.push({ step: "wait", at: now(), detail: { timeoutMs } });
    try {
      await ctx.session.wait({ sessionID: child.id }, { signal: AbortSignal.timeout(timeoutMs) });
      steps.push({ step: "idle", at: now() });
    } catch (error) {
      const message = errorMessage(error);
      steps.push({ step: "wait-failed", at: now(), detail: message });
      result.error = message;
      await ctx.session.interrupt({ sessionID: child.id, resume: false });
    }

    steps.push({ step: "context", at: now() });
    const messages = await ctx.session.context({ sessionID: child.id });
    result.messageCount = messages.length;
    result.assistantText = extractLastAssistantText(messages);

    steps.push({ step: "session-info", at: now() });
    const info = await ctx.session.get({ sessionID: child.id });
    result.cost = info.cost;
    result.tokens = info.tokens;

    steps.push({ step: "diff", at: now() });
    try {
      result.diff = await ctx.vcs.diff({ mode: "working", context: 3 });
    } catch (error) {
      result.diff = { error: errorMessage(error) };
    }

    steps.push({ step: "interrupt", at: now() });
    result.interrupt = await ctx.session.interrupt({ sessionID: child.id, resume: false });

    result.ok = typeof result.assistantText === "string" && result.assistantText.length > 0;
    steps.push({ step: "done", at: now(), detail: { ok: result.ok } });
    return result;
  } catch (error) {
    result.error = errorMessage(error);
    steps.push({ step: "error", at: now(), detail: result.error });
    return result;
  } finally {
    if (childSessionID && !keep) {
      try {
        steps.push({ step: "remove-child", at: now(), detail: { sessionID: childSessionID } });
        await ctx.session.remove({ sessionID: childSessionID });
      } catch (error) {
        steps.push({ step: "remove-child-failed", at: now(), detail: errorMessage(error) });
      }
    }
  }
}
