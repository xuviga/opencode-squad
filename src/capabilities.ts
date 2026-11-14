import type { Plugin } from "@opencode/plugin";

export type CapabilityKind = "skill" | "mcp" | "tool" | "unknown";

export type ResolvedCapability = {
  raw: string;
  kind: CapabilityKind;
  id: string;
  available: boolean;
  /** Instruction appended to the Task Brief for the employee. */
  guidance: string;
};

const PREFIXES: CapabilityKind[] = ["skill", "mcp", "tool"];

export function parseCapability(raw: string): { kind?: CapabilityKind; id: string } {
  const trimmed = raw.trim();
  const separator = trimmed.indexOf(":");
  if (separator > 0) {
    const prefix = trimmed.slice(0, separator).toLowerCase();
    if ((PREFIXES as string[]).includes(prefix)) {
      return { kind: prefix as CapabilityKind, id: trimmed.slice(separator + 1).trim() };
    }
  }
  return { id: trimmed };
}

type SkillInfo = { id: string; name: string; description?: string };
type McpInfo = { name: string; status?: { status?: string } };

async function loadSkills(ctx: Plugin.Context): Promise<SkillInfo[]> {
  try {
    const result = await ctx.skill.list();
    return (result?.data ?? []) as SkillInfo[];
  } catch {
    return [];
  }
}

async function loadMcp(ctx: Plugin.Context): Promise<McpInfo[]> {
  try {
    const result = await ctx.mcp.list();
    return (result?.data ?? []) as McpInfo[];
  } catch {
    return [];
  }
}

async function loadTools(ctx: Plugin.Context): Promise<Array<{ id: string; name: string }>> {
  try {
    const tools = await ctx.tool.list();
    return tools.map((tool) => ({ id: tool.id, name: tool.name }));
  } catch {
    return [];
  }
}

function matches(value: string, candidate: string): boolean {
  return value.toLowerCase() === candidate.toLowerCase();
}

function toolMatches(tool: { id: string; name: string }, requested: string): boolean {
  const value = requested.toLowerCase();
  const names = new Set(
    [tool.id, tool.name, `squad.${tool.name}`, `squad.${tool.id}`].map((item) =>
      item.toLowerCase(),
    ),
  );
  if (names.has(value)) return true;
  const tail = value.split(".").pop();
  return tail !== undefined && names.has(tail);
}

export async function resolveCapabilities(
  ctx: Plugin.Context,
  rawCapabilities: readonly string[],
): Promise<{ resolved: ResolvedCapability[]; warnings: string[]; guidance: string[] }> {
  const deduped = Array.from(new Set(rawCapabilities.map((item) => item.trim()).filter(Boolean)));
  if (deduped.length === 0) {
    return { resolved: [], warnings: [], guidance: [] };
  }

  const [skills, mcpServers, tools] = await Promise.all([
    loadSkills(ctx),
    loadMcp(ctx),
    loadTools(ctx),
  ]);

  const resolved: ResolvedCapability[] = [];
  const warnings: string[] = [];

  for (const raw of deduped) {
    const parsed = parseCapability(raw);

    if (parsed.kind === "skill" || parsed.kind === undefined) {
      const skill = skills.find(
        (item) => matches(item.id, parsed.id) || matches(item.name, parsed.id),
      );
      if (skill) {
        resolved.push({
          raw,
          kind: "skill",
          id: skill.id,
          available: true,
          guidance: `Capability: skill "${skill.name}". Load it with the skill tool before starting the deliverable.`,
        });
        continue;
      }
      if (parsed.kind === "skill") {
        warnings.push(`unknown skill: ${parsed.id}`);
        resolved.push({
          raw,
          kind: "skill",
          id: parsed.id,
          available: false,
          guidance: `Capability: skill "${parsed.id}" is NOT installed. Do not claim to use it.`,
        });
        continue;
      }
    }

    if (parsed.kind === "mcp" || parsed.kind === undefined) {
      const server = mcpServers.find((item) => matches(item.name, parsed.id));
      if (server) {
        const status = server.status?.status ?? "unknown";
        const connected = status === "connected";
        if (!connected) warnings.push(`mcp server ${server.name} is ${status}`);
        resolved.push({
          raw,
          kind: "mcp",
          id: server.name,
          available: connected,
          guidance: `Capability: MCP server "${server.name}" (${status}). Its tools are exposed in this session; prefer them for domain work.`,
        });
        continue;
      }
      if (parsed.kind === "mcp") {
        warnings.push(`unknown mcp server: ${parsed.id}`);
        resolved.push({
          raw,
          kind: "mcp",
          id: parsed.id,
          available: false,
          guidance: `Capability: MCP server "${parsed.id}" is NOT configured. Do not pretend to call it.`,
        });
        continue;
      }
    }

    if (parsed.kind === "tool" || parsed.kind === undefined) {
      const tool = tools.find((item) => toolMatches(item, parsed.id));
      if (tool) {
        resolved.push({
          raw,
          kind: "tool",
          id: tool.id,
          available: true,
          guidance: `Capability: tool "${tool.id}" is available; use it when the deliverable needs it.`,
        });
        continue;
      }
      if (parsed.kind === "tool") {
        warnings.push(`unknown tool: ${parsed.id}`);
        resolved.push({
          raw,
          kind: "tool",
          id: parsed.id,
          available: false,
          guidance: `Capability: tool "${parsed.id}" is NOT available. Use the closest available tool and state the gap.`,
        });
        continue;
      }
    }

    warnings.push(`unresolved capability: ${raw}`);
    resolved.push({
      raw,
      kind: "unknown",
      id: parsed.id,
      available: false,
      guidance: `Capability "${raw}" could not be resolved to a skill, MCP server or tool. State the gap instead of inventing it.`,
    });
  }

  return { resolved, warnings, guidance: resolved.map((item) => item.guidance) };
}
