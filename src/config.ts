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
  grades: Record<Grade, GradeModel>;
};

export const DEFAULT_CONFIG: SquadConfig = {
  dataDir: ".squad",
  dbFile: ".squad/squad.db",
  maxRework: 2,
  softWarnPct: [70, 90],
  hardLimitUsd: null,
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
