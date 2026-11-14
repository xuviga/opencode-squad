import type { Plugin } from "@opencode/plugin";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
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
  worktreeDirectory: string | null;
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
  const projectID = ctx.location.project.id;
  const needsWorktree = spec.access !== "read-only";

  let worktreeDirectory: string | null = null;
  if (needsWorktree) {
    try {
      const worktree = await ctx.worktree.create({
        projectID,
        name: `squad-${request.persona}-${randomUUID().replace(/-/g, "").slice(0, 6)}`,
      });
      worktreeDirectory = worktree.directory;
    } catch (error) {
      throw new Error(
        `worktree isolation failed for ${request.persona}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  let session: Awaited<ReturnType<typeof ctx.session.create>> | undefined;
  try {
    session = await ctx.session.create({
      parentID: request.parentSessionID,
      title: request.title ?? `SQUAD ${request.persona} (${grade})`,
      agent,
      model: {
        id: model.modelID,
        providerID: model.providerID,
        variant: model.variant,
      },
      location: { directory: worktreeDirectory ?? ctx.location.directory },
      permissions: personaPermissions(spec.access),
    });

    // The host may inherit the parent location for child sessions and ignore
    // the location argument. Move explicitly so a writer cannot touch main.
    if (worktreeDirectory) {
      await ctx.session.move({ sessionID: session.id, directory: worktreeDirectory });
      let actualDirectory = "";
      const expectedDirectory = resolve(worktreeDirectory);
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const current = await ctx.session.get({ sessionID: session.id });
        actualDirectory = current.location.directory;
        if (resolve(actualDirectory) === expectedDirectory) break;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
      }
      if (resolve(actualDirectory) !== expectedDirectory) {
        throw new Error(
          `session isolation failed: expected ${expectedDirectory}, got ${actualDirectory}`,
        );
      }
    }
  } catch (error) {
    if (session) {
      await ctx.session.remove({ sessionID: session.id }).catch(() => undefined);
    }
    if (worktreeDirectory) {
      await ctx.worktree
        .remove({ projectID, directory: worktreeDirectory, force: true })
        .catch(() => undefined);
    }
    throw error;
  }

  try {
    const staff = store.hireStaff({
      persona: request.persona,
      grade,
      agent,
      provider: model.providerID,
      model: model.modelID,
      variant: model.variant,
      sessionID: session.id,
      worktreeDirectory,
    });
    return {
      staff,
      sessionID: session.id,
      agent,
      grade,
      model,
      access: spec.access,
      worktreeDirectory,
    };
  } catch (error) {
    await ctx.session.remove({ sessionID: session.id }).catch(() => undefined);
    if (worktreeDirectory) {
      await ctx.worktree
        .remove({ projectID, directory: worktreeDirectory, force: true })
        .catch(() => undefined);
    }
    throw error;
  }
}
