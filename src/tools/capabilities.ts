import type { Plugin } from "@opencode/plugin";
import { resolveCapabilities } from "../capabilities";
import { fail, ok } from "./result";

type CapabilitiesInput = {
  capabilities?: string[];
};

export async function registerCapabilitiesTool(ctx: Plugin.Context) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "capabilities",
      description:
        "Resolve capability strings to installed skills, connected MCP servers and available tools. Use before planning a task that depends on them. Prefixes: skill:, mcp:, tool:.",
      input: {
        type: "object",
        properties: {
          capabilities: { type: "array", items: { type: "string" } },
        },
        required: ["capabilities"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input) => {
        const args = (input ?? {}) as CapabilitiesInput;
        try {
          const result = await resolveCapabilities(ctx, args.capabilities ?? []);
          return ok({
            resolved: result.resolved,
            warnings: result.warnings,
            available: result.resolved.filter((item) => item.available).length,
            missing: result.resolved.filter((item) => !item.available).length,
          });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
