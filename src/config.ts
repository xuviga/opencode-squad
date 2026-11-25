import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Grade = "G0" | "G1" | "G2" | "G3" | "G4";

export type GradeModel = {
  providerID: string;
  modelID: string;
  variant: string;
};

export type SquadConfig = {
  dataDir: string;
  dbFile: string;
  maxRework: number;
  softWarnPct: [number, number];
  hardLimitUsd: number | null;
  /** Missions untouched for this many minutes are reported/cancelled by squad_gc. */
  staleAfterMinutes: number;
  /** Minutes between automatic janitor scans. 0 disables the scheduler. */
  gcIntervalMinutes: number;
  /** When true the scheduled janitor aborts stale missions instead of only reporting. */
  gcAutoAbort: boolean;
  grades: Record<Grade, GradeModel>;
};

export const DEFAULT_CONFIG: SquadConfig = {
  dataDir: ".squad",
  dbFile: ".squad/squad.db",
  maxRework: 2,
  softWarnPct: [70, 90],
  hardLimitUsd: null,
  staleAfterMinutes: 120,
  gcIntervalMinutes: 60,
  gcAutoAbort: false,
  grades: {
    G0: { providerID: "deepseek", modelID: "deepseek-flash", variant: "none" },
    G1: { providerID: "deepseek", modelID: "deepseek-flash", variant: "low" },
    G2: { providerID: "deepseek", modelID: "deepseek-flash", variant: "high" },
    G3: { providerID: "deepseek", modelID: "deepseek-v4-pro", variant: "high" },
    G4: { providerID: "deepseek", modelID: "deepseek-v4-pro", variant: "max" },
  },
};

export function resolveGrade(config: SquadConfig, grade: Grade): GradeModel {
  return config.grades[grade];
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function integerField(value: unknown, path: string, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${path} must be an integer`);
  }
  if (value < min || value > max) throw new Error(`${path} must be between ${min} and ${max}`);
  return value;
}

function stringField(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Reads `.squad/config.json` and merges it over the defaults.
 *
 * A broken file is a hard error: silently running with defaults after a typo
 * is how a mission gets the wrong budget or the wrong grade model. Unknown
 * keys are ignored so a newer file can still be opened by an older plugin.
 */
export function loadSquadConfig(directory: string, fileName = ".squad/config.json"): SquadConfig {
  const configPath = join(directory, fileName);
  if (!existsSync(configPath)) return DEFAULT_CONFIG;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `cannot parse ${fileName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const file = asRecord(raw, fileName);
  const config: SquadConfig = {
    ...DEFAULT_CONFIG,
    grades: { ...DEFAULT_CONFIG.grades },
  };

  if (file.dataDir !== undefined) config.dataDir = stringField(file.dataDir, "dataDir");
  if (file.dbFile !== undefined) config.dbFile = stringField(file.dbFile, "dbFile");
  if (file.maxRework !== undefined) {
    config.maxRework = integerField(file.maxRework, "maxRework", 0, 50);
  }
  if (file.softWarnPct !== undefined) {
    if (!Array.isArray(file.softWarnPct) || file.softWarnPct.length !== 2) {
      throw new Error("softWarnPct must be [soft, hard]");
    }
    const soft = integerField(file.softWarnPct[0], "softWarnPct[0]", 1, 1000);
    const hard = integerField(file.softWarnPct[1], "softWarnPct[1]", 1, 1000);
    if (soft >= hard) throw new Error("softWarnPct must be ascending: [soft, hard]");
    config.softWarnPct = [soft, hard];
  }
  if (file.hardLimitUsd !== undefined) {
    if (file.hardLimitUsd === null) {
      config.hardLimitUsd = null;
    } else if (typeof file.hardLimitUsd === "number" && file.hardLimitUsd > 0) {
      config.hardLimitUsd = file.hardLimitUsd;
    } else {
      throw new Error("hardLimitUsd must be a positive number or null");
    }
  }
  if (file.staleAfterMinutes !== undefined) {
    config.staleAfterMinutes = integerField(file.staleAfterMinutes, "staleAfterMinutes", 1);
  }
  if (file.gcIntervalMinutes !== undefined) {
    config.gcIntervalMinutes = integerField(file.gcIntervalMinutes, "gcIntervalMinutes", 0, 1440);
  }
  if (file.gcAutoAbort !== undefined) {
    if (typeof file.gcAutoAbort !== "boolean") throw new Error("gcAutoAbort must be a boolean");
    config.gcAutoAbort = file.gcAutoAbort;
  }
  if (file.grades !== undefined) {
    const grades = asRecord(file.grades, "grades");
    for (const grade of ["G0", "G1", "G2", "G3", "G4"] as Grade[]) {
      const entry = grades[grade];
      if (entry === undefined) continue;
      const model = asRecord(entry, `grades.${grade}`);
      config.grades[grade] = {
        providerID: stringField(model.providerID, `grades.${grade}.providerID`),
        modelID: stringField(model.modelID, `grades.${grade}.modelID`),
        variant: typeof model.variant === "string" ? model.variant : "",
      };
    }
  }

  return config;
}
