import type { Plugin } from "@opencode/plugin";

/**
 * Best-effort teardown of a hired helper session (reviewer, second reviewer,
 * arbiter, auditor). The ledger already holds its cost and tokens, so the
 * session itself is disposable: interrupt the model work, then remove it.
 * Returns true when the session is gone.
 */
export async function releaseSession(
  ctx: Plugin.Context,
  sessionID: string | null | undefined,
): Promise<boolean> {
  if (!sessionID) return false;
  await ctx.session.interrupt({ sessionID, resume: false }).catch(() => undefined);
  try {
    await ctx.session.remove({ sessionID });
    return true;
  } catch {
    return false;
  }
}
