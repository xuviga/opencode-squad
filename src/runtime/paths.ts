import type { Plugin } from "@opencode/plugin";
import { isAbsolute, relative, resolve, sep } from "node:path";

export async function sessionDirectory(
  ctx: Plugin.Context,
  sessionID: string,
): Promise<string> {
  try {
    const info = await ctx.session.get({ sessionID });
    return info.location.directory;
  } catch {
    return ctx.location.directory;
  }
}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  if (rel === "") return true;
  if (isAbsolute(rel)) return false;
  return !rel.startsWith("..") && !rel.startsWith(`..${sep}`);
}

/**
 * Resolves a user/tool path against the current session directory and allows
 * it only inside that directory or the project root.
 */
export function resolveProjectPath(
  base: string,
  project: string,
  input: string,
): string {
  const target = isAbsolute(input) ? resolve(input) : resolve(base, input);
  const roots = [resolve(base), resolve(project)];
  if (!roots.some((root) => isInside(root, target))) {
    throw new Error(`path escapes the project/session directory: ${input}`);
  }
  return target;
}
