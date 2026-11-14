import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acquireInPlaceLock,
  ensureInPlaceLock,
  readInPlaceLock,
  releaseInPlaceLock,
} from "../src/runtime/inplace-lock";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "squad-lock-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("in-place folder lock", () => {
  test("one mission owns the folder at a time", () => {
    expect(acquireInPlaceLock(directory, "m_one").ok).toBe(true);
    const second = acquireInPlaceLock(directory, "m_two");
    expect(second.ok).toBe(false);
    expect(second.holder?.missionID).toBe("m_one");

    expect(releaseInPlaceLock(directory, "m_two")).toBe(false);
    expect(releaseInPlaceLock(directory, "m_one")).toBe(true);
    expect(acquireInPlaceLock(directory, "m_two").ok).toBe(true);
  });

  test("the same mission can re-acquire its own lock", () => {
    expect(acquireInPlaceLock(directory, "m_one").ok).toBe(true);
    expect(acquireInPlaceLock(directory, "m_one").ok).toBe(true);
  });

  test("a stale lock is evicted", () => {
    acquireInPlaceLock(directory, "m_old");
    const path = join(directory, ".squad", "locks", "inplace.json");
    const lock = JSON.parse(readFileSync(path, "utf8"));
    lock.createdAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    writeFileSync(path, JSON.stringify(lock), "utf8");

    const acquired = acquireInPlaceLock(directory, "m_new");
    expect(acquired.ok).toBe(true);
    expect(acquired.stale).toBe(true);
    expect(readInPlaceLock(directory)?.missionID).toBe("m_new");
  });

  test("ensure evicts a terminal holder", () => {
    acquireInPlaceLock(directory, "m_done");
    const acquired = ensureInPlaceLock(directory, "m_next", (id) => id === "m_done");
    expect(acquired.ok).toBe(true);
    expect(readInPlaceLock(directory)?.missionID).toBe("m_next");
  });
});
