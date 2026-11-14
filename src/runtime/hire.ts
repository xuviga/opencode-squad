import type { Plugin } from "@opencode/plugin";
import { DEFAULT_CONFIG } from "../config";
import type { SquadStore, Staff } from "../db/store";
import { gradeOrDefault, personaPermissions, resolvePersona } from "../personas";

export type HireRequest = {
  missionID: string;
  persona: string;
  grade?: string;
  agent?: string;
  parentSessionID: string;
  title?: string;
};

export type HireResult = {
  staff: Staff;
  sessionID: string;
  agent: string;
  grade: string;
  model: { providerID: string; modelID: string; variant: string };
  access: string;
};

export async function hireEmployee(
  ctx: Plugin.Context,
  store: SquadStore,
  request: HireRequest,
): Promise<HireResult> {
  const spec = resolvePersona(request.persona);
  const grade = gradeOrDefault(request.persona, request.grade);
  if (store.isBlacklisted(request.persona, grade)) {
    throw new Error(`persona/grade is blacklisted: ${request.persona}/${grade}`);
  }
  const model = DEFAULT_CONFIG.grades[grade];
  const agent = request.agent?.trim() || spec.agent;

  const session = await ctx.session.create({
    parentID: request.parentSessionID,
    title: request.title ?? `SQUAD ${request.persona} (${grade})`,
    agent,
    model: {
      id: model.modelID,
      providerID: model.providerID,
      variant: model.variant,
    },
    location: { directory: ctx.location.directory },
    permissions: personaPermissions(spec.access),
  });

  try {
    const staff = store.hireStaff({
      persona: request.persona,
      grade,
      agent,
      provider: model.providerID,
      model: model.modelID,
      variant: model.variant,
      sessionID: session.id,
    });
    return {
      staff,
      sessionID: session.id,
      agent,
      grade,
      model,
      access: spec.access,
    };
  } catch (error) {
    await ctx.session.remove({ sessionID: session.id }).catch(() => undefined);
    throw error;
  }
}
