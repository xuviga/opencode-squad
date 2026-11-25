import type { SquadConfig } from "../config";
import type { SquadStore } from "../db/store";

export type JanitorReport = {
  at: string;
  staleAfterMinutes: number;
  stale: Array<{ id: string; status: string; idleMinutes: number }>;
  aborted: string[];
};

/** Read-only scan the scheduler runs; also used by tests. */
export function scanStale(store: SquadStore, staleAfterMinutes: number): JanitorReport {
  const stale = store.listStaleMissions(staleAfterMinutes).map((mission) => ({
    id: mission.id,
    status: mission.status,
    idleMinutes: Math.max(0, Math.round((Date.now() - Date.parse(mission.updatedAt)) / 60_000)),
  }));
  return { at: new Date().toISOString(), staleAfterMinutes, stale, aborted: [] };
}

/**
 * Starts the scheduled janitor.
 *
 * By default it only reports: an automatic abort is destructive and needs
 * `gcAutoAbort: true` in `.squad/config.json`. Returns a stop function that
 * clears the interval; the plugin calls it on dispose.
 */
export function startJanitor(
  store: SquadStore,
  config: SquadConfig,
  onReport: (report: JanitorReport) => void,
): () => void {
  if (config.gcIntervalMinutes <= 0) return () => undefined;
  const intervalMs = config.gcIntervalMinutes * 60_000;

  const tick = () => {
    try {
      const report = scanStale(store, config.staleAfterMinutes);
      if (config.gcAutoAbort) {
        for (const mission of report.stale) {
          try {
            store.abortMission(mission.id, `stale: idle ${mission.idleMinutes} minutes`);
            report.aborted.push(mission.id);
          } catch {
            // a mission that moved between scan and abort is simply skipped
          }
        }
        for (const missionID of report.aborted) {
          store.addEvent(missionID, null, "gc.auto_abort", {
            staleAfterMinutes: config.staleAfterMinutes,
          });
        }
      }
      if (report.stale.length > 0) {
        for (const mission of report.stale) {
          store.addEvent(mission.id, null, "gc.stale", {
            idleMinutes: mission.idleMinutes,
            aborted: report.aborted.includes(mission.id),
          });
        }
      }
      onReport(report);
    } catch (error) {
      onReport({
        at: new Date().toISOString(),
        staleAfterMinutes: config.staleAfterMinutes,
        stale: [],
        aborted: [],
      });
      console.error("[squad] janitor failed", error);
    }
  };

  const timer = setInterval(tick, intervalMs);
  // Node keeps the process alive for timers; the host should not be held open.
  (timer as { unref?: () => void }).unref?.();
  return () => clearInterval(timer);
}
