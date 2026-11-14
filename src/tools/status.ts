import type { Plugin } from "@opencode/plugin";
import { DEFAULT_CONFIG, type Grade } from "../config";
import type { SquadStore } from "../db/store";
import { VERSION } from "../version";

export type RpcRuntimeState = {
  registered: boolean;
  error?: string;
};

function gradeSnapshot() {
  return Object.entries(DEFAULT_CONFIG.grades).map(([grade, model]) => ({
    grade: grade as Grade,
    ...model,
  }));
}

export async function registerStatusTool(
  ctx: Plugin.Context,
  store: SquadStore,
  rpcState: RpcRuntimeState = { registered: false },
) {
  return ctx.tool.transform((editor) => {
    editor.namespace({
      name: "squad",
      description: "SQUAD multi-agent orchestrator",
    });

    editor.add({
      name: "status",
      description:
        "Report SQUAD plugin status and a snapshot of the OpenCode capability registry (models, agents, tools, skills, plugins).",
      input: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async () => {
        const [modelResponse, agentResponse, tools, skillResponse, pluginResponse, sessions] =
          await Promise.all([
            ctx.model.list(),
            ctx.agent.list(),
            ctx.tool.list(),
            ctx.skill.list(),
            ctx.plugin.list(),
            ctx.session.list({ directory: ctx.location.directory, limit: 10 }),
          ]);

        const models = modelResponse.data;
        const agents = agentResponse.data;
        const skills = skillResponse.data;
        const plugins = pluginResponse.data;

        const deepseek = models
          .filter((model) => model.providerID === "deepseek")
          .map((model) => ({
            id: model.id,
            name: model.name,
            variants: model.variants.map((variant) => variant.id),
            status: model.status,
            enabled: model.enabled,
            cost: model.cost,
            limit: model.limit,
          }));

        const payload = {
          plugin: "squad",
          version: VERSION,
          loadedAt: new Date().toISOString(),
          rpc: rpcState,
          location: {
            directory: ctx.location.directory,
            workspaceID: ctx.location.workspaceID,
            projectID: ctx.location.project.id,
            canonical: ctx.location.project.canonical,
          },
          counts: {
            models: models.length,
            agents: agents.length,
            tools: tools.length,
            skills: skills.length,
            plugins: plugins.length,
            builtinPlugins: plugins.filter((plugin) => plugin.source.type === "builtin").length,
            externalPlugins: plugins.filter((plugin) => plugin.source.type !== "builtin").length,
            sessions: sessions.data.length,
            missions: store.countMissions(),
            staff: store.countStaff(),
            tasks: store.countTasks(),
            blacklist: store.countBlacklist(),
            disputes: store.countDisputes(),
            audits: store.countAudits(),
            lessons: store.countLessons(),
          },
          deepseek,
          grades: gradeSnapshot(),
          agents: agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            mode: agent.mode,
            model: agent.model,
          })),
          squadTools: tools
            .filter((tool) => tool.id.startsWith("squad_"))
            .map((tool) => ({ id: tool.id, description: tool.description })),
          plugins: plugins
            .filter((plugin) => plugin.source.type !== "builtin")
            .map((plugin) => ({
              id: plugin.id ?? "(unnamed)",
              state: plugin.state.status,
              source: plugin.source.type,
            })),
        };

        return { content: JSON.stringify(payload, null, 2) };
      },
    });
  });
}
