import type { Grade } from "./config";
import type { PlanGrade } from "./plan";

export type PersonaSpec = {
  defaultGrade: PlanGrade;
  agent: string;
  access: "read-only" | "write" | "shell";
};

export const PERSONAS: Record<string, PersonaSpec> = {
  architect: { defaultGrade: "G3", agent: "plan", access: "read-only" },
  implementer: { defaultGrade: "G2", agent: "build", access: "shell" },
  "test-smith": { defaultGrade: "G2", agent: "build", access: "shell" },
  researcher: { defaultGrade: "G1", agent: "explore", access: "read-only" },
  designer: { defaultGrade: "G3", agent: "build", access: "write" },
  writer: { defaultGrade: "G2", agent: "build", access: "write" },
  "data-analyst": { defaultGrade: "G3", agent: "build", access: "shell" },
  "ops-runner": { defaultGrade: "G2", agent: "build", access: "shell" },
  reviewer: { defaultGrade: "G4", agent: "squad-reviewer", access: "read-only" },
  critic: { defaultGrade: "G4", agent: "squad-reviewer", access: "read-only" },
  integrator: { defaultGrade: "G4", agent: "build", access: "shell" },
  auditor: { defaultGrade: "G2", agent: "squad-auditor", access: "read-only" },
  arbiter: { defaultGrade: "G4", agent: "squad-arbiter", access: "read-only" },
  scribe: { defaultGrade: "G1", agent: "build", access: "write" },
};

export function resolvePersona(persona: string): PersonaSpec {
  const spec = PERSONAS[persona];
  if (!spec) {
    throw new Error(
      `unknown persona: ${persona}. Known: ${Object.keys(PERSONAS).join(", ")}`,
    );
  }
  return spec;
}

export function personaPermissions(access: PersonaSpec["access"]) {
  const denySubagent = { action: "subagent", resource: "*", effect: "deny" as const };
  if (access === "read-only") {
    return [
      { action: "edit", resource: "*", effect: "deny" as const },
      { action: "shell", resource: "*", effect: "deny" as const },
      denySubagent,
    ];
  }
  if (access === "write") {
    return [
      { action: "edit", resource: "*", effect: "allow" as const },
      { action: "shell", resource: "*", effect: "deny" as const },
      denySubagent,
    ];
  }
  return [
    { action: "edit", resource: "*", effect: "allow" as const },
    { action: "shell", resource: "*", effect: "allow" as const },
    denySubagent,
  ];
}

export function gradeOrDefault(persona: string, grade?: string): PlanGrade {
  if (grade) {
    if (!["G0", "G1", "G2", "G3", "G4"].includes(grade)) {
      throw new Error(`unknown grade: ${grade}`);
    }
    return grade as PlanGrade;
  }
  return resolvePersona(persona).defaultGrade;
}

export function nextGrade(grade: string): PlanGrade {
  const order: PlanGrade[] = ["G0", "G1", "G2", "G3", "G4"];
  const index = order.indexOf(grade as PlanGrade);
  if (index < 0) throw new Error(`unknown grade: ${grade}`);
  return order[Math.min(index + 1, order.length - 1)]!;
}

export type GradeConfig = Record<Grade, { providerID: string; modelID: string; variant: string }>;
