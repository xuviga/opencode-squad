import type { Plugin } from "@opencode/plugin";
import { runSessionProbe, type ProbeOptions } from "../runtime/probe";

type ProbeInput = {
  prompt?: string;
  agent?: string;
  providerID?: string;
  modelID?: string;
  variant?: string;
  timeoutMs?: number;
  keep?: boolean;
};

export async function registerProbeTool(ctx: Plugin.Context) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "probe",
      description:
        "Run the SQUAD capability probe: create a child session, send a prompt, wait for idle, read context/diff, interrupt, and optionally keep the child session.",
      input: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          agent: { type: "string" },
          providerID: { type: "string" },
          modelID: { type: "string" },
          variant: { type: "string" },
          timeoutMs: { type: "number" },
          keep: { type: "boolean" },
        },
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const options = (input ?? {}) as ProbeInput;

        await ctx.permission.assert({
          sessionID: context.sessionID,
          agent: context.agent,
          source: {
            type: "tool",
            messageID: context.messageID,
            id: context.id,
          },
          action: "squad_probe",
          resources: ["probe"],
          metadata: {
            agent: options.agent,
            providerID: options.providerID,
            modelID: options.modelID,
            variant: options.variant,
          },
        });

        await context.progress({ status: "creating child session" });
        const result = await runSessionProbe(ctx, context.sessionID, options satisfies ProbeOptions);
        return { content: JSON.stringify(result, null, 2) };
      },
    });
  });
}
