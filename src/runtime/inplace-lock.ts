import { closeSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type InPlaceLock = {
  missionID: string;
  createdAt: string;
  pid: number;
};

export type AcquireResult = {
  ok: boolean;
  holder?: InPlaceLock;
  stale?: boolean;
  error?: string;
};

const LOCK_DIRECTORY = join(".squad", "locks");
const LOCK_FILE = "inplace.json";
const DEFAULT_STALE_MINUTES = 120;

function lockPath(directory: string): string {
  return join(directory, LOCK_DIRECTORY, LOCK_FILE);
}

export function readInPlaceLock(directory: string): InPlaceLock | undefined {
  try {
    const parsed = JSON.parse(readFileSync(lockPath(directory), "utf8")) as InPlaceLock;
    if (!parsed?.missionID) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function lockAgeMs(directory: string, lock: InPlaceLock): number {
  const created = Date.parse(lock.createdAt);
  if (Number.isFinite(created)) return Date.now() - created;
  try {
    return Date.now() - statSync(lockPath(directory)).mtimeMs;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function writeLock(directory: string, missionID: string): void {
  mkdirSync(join(directory, LOCK_DIRECTORY), { recursive: true });
  writeFileSync(
    lockPath(directory),
    JSON.stringify(
      { missionID, createdAt: new Date().toISOString(), pid: process.pid } satisfies InPlaceLock,
      null,
      2,
    ),
    "utf8",
  );
}

/**
 * Exclusive folder lock for in-place missions. Without it two missions can
 * snapshot and write the same directory and produce false diffs.
 */
export function acquireInPlaceLock(
  directory: string,
  missionID: string,
  options: { staleMinutes?: number } = {},
): AcquireResult {
  const staleMinutes = options.staleMinutes ?? DEFAULT_STALE_MINUTES;
  mkdirSync(join(directory, LOCK_DIRECTORY), { recursive: true });

  try {
    const fd = openSync(lockPath(directory), "wx");
    closeSync(fd);
    writeLock(directory, missionID);
    return { ok: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  const holder = readInPlaceLock(directory);
  if (!holder) {
    writeLock(directory, missionID);
    return { ok: true, stale: true };
  }

  if (holder.missionID === missionID) {
    writeLock(directory, missionID);
    return { ok: true };
  }

  if (lockAgeMs(directory, holder) > staleMinutes * 60_000) {
    writeLock(directory, missionID);
    return { ok: true, stale: true, holder };
  }

  return { ok: false, holder };
}

/** Releases the lock only if the caller owns it. */
export function releaseInPlaceLock(directory: string, missionID: string): boolean {
  const holder = readInPlaceLock(directory);
  if (!holder || holder.missionID !== missionID) return false;
  try {
    unlinkSync(lockPath(directory));
    return true;
  } catch {
    return false;
  }
}

/**
 * Acquires the lock, first evicting a holder whose mission is already
 * terminal (finished, failed, cancelled or missing).
 */
export function ensureInPlaceLock(
  directory: string,
  missionID: string,
  isTerminalMission: (missionID: string) => boolean,
): AcquireResult {
  const holder = readInPlaceLock(directory);
  if (holder && holder.missionID !== missionID && isTerminalMission(holder.missionID)) {
    releaseInPlaceLock(directory, holder.missionID);
  }
  return acquireInPlaceLock(directory, missionID);
}
