import type { MissionPlan, PlanGrade, PlanTask, TaskClass } from "./plan";
import { validatePlan } from "./plan";

export type ClassStep = {
  /** Suffix used to build the task id together with the plan prefix. */
  suffix: string;
  title: string;
  role: string;
  grade: PlanGrade;
  acceptance: string[];
  capabilities?: string[];
  /** Suffixes of steps this step depends on. */
  dependsOn?: string[];
};

export type ClassTemplate = {
  class: Exclude<TaskClass, "mixed">;
  label: string;
  summary: string;
  /** Capabilities shared by every step of the class. */
  capabilities: string[];
  steps: ClassStep[];
};

export const CLASS_TEMPLATES: Record<Exclude<TaskClass, "mixed">, ClassTemplate> = {
  code: {
    class: "code",
    label: "Code change",
    summary: "Implement a change in an isolated worktree, then prove it with automated checks.",
    capabilities: [],
    steps: [
      {
        suffix: "impl",
        title: "Implement the change",
        role: "implementer",
        grade: "G2",
        acceptance: [
          "Deliverable files are changed inside the worktree",
          "Every claim is backed by an evidence entry with a command and exit code",
          "No placeholders or TODO stubs are left in the deliverable",
        ],
      },
      {
        suffix: "verify",
        title: "Verify the change",
        role: "test-smith",
        grade: "G2",
        dependsOn: ["impl"],
        acceptance: [
          "Automated checks run against the changed code",
          "Every check result includes the command, exit code and output tail",
          "A failing check is reported as blocked or failed, never hidden",
        ],
      },
    ],
  },
  research: {
    class: "research",
    label: "Research",
    summary: "Collect primary evidence, then synthesize a direct answer with traceable sources.",
    capabilities: ["tool:websearch"],
    steps: [
      {
        suffix: "collect",
        title: "Collect sources and evidence",
        role: "researcher",
        grade: "G1",
        acceptance: [
          "Sources are listed with links or file paths",
          "Facts are separated from interpretation",
          "At least three independent sources or one primary source are cited",
        ],
      },
      {
        suffix: "synthesize",
        title: "Synthesize the answer",
        role: "writer",
        grade: "G2",
        dependsOn: ["collect"],
        acceptance: [
          "The answer addresses the mission goal directly",
          "Every claim traces back to collected sources",
          "Uncertainty and gaps are stated explicitly",
        ],
      },
    ],
  },
  writing: {
    class: "writing",
    label: "Writing",
    summary: "Outline for the audience, then produce a complete draft with attributable claims.",
    capabilities: [],
    steps: [
      {
        suffix: "outline",
        title: "Outline the piece",
        role: "writer",
        grade: "G1",
        acceptance: [
          "Structure lists sections in reading order",
          "Each section has a one-line purpose",
          "Audience, tone and target length are stated",
        ],
      },
      {
        suffix: "draft",
        title: "Write the final draft",
        role: "writer",
        grade: "G2",
        dependsOn: ["outline"],
        acceptance: [
          "Final text is complete with no placeholders",
          "Tone and length match the brief",
          "Quotes and claims are attributable",
        ],
      },
    ],
  },
  design: {
    class: "design",
    label: "Design",
    summary: "Explore distinct directions, then produce the chosen artifact and its preview.",
    capabilities: ["tool:squad.image"],
    steps: [
      {
        suffix: "concept",
        title: "Develop design directions",
        role: "designer",
        grade: "G3",
        acceptance: [
          "At least three distinct directions are described",
          "Palette, type and layout choices are justified",
          "Constraints from the brief are respected",
        ],
      },
      {
        suffix: "produce",
        title: "Produce the final design",
        role: "designer",
        grade: "G2",
        dependsOn: ["concept"],
        acceptance: [
          "Final artifact files exist in the worktree",
          "The design follows the approved direction",
          "A rendered preview or image path is listed in artifacts",
        ],
      },
    ],
  },
  data: {
    class: "data",
    label: "Data analysis",
    summary: "Extract reproducible data, then analyze it with units, assumptions and commands.",
    capabilities: [],
    steps: [
      {
        suffix: "extract",
        title: "Extract the data",
        role: "data-analyst",
        grade: "G2",
        acceptance: [
          "Data sources and row counts are listed",
          "Extraction is reproducible with a recorded command",
          "No secrets or personal data are echoed",
        ],
      },
      {
        suffix: "analyze",
        title: "Analyze and report",
        role: "data-analyst",
        grade: "G3",
        dependsOn: ["extract"],
        acceptance: [
          "Every number has a unit and a source",
          "Method and assumptions are stated",
          "Results are reproducible from the recorded commands",
        ],
      },
    ],
  },
  ops: {
    class: "ops",
    label: "Operations",
    summary: "Prepare an ordered runbook with rollback, then execute it with recorded results.",
    capabilities: [],
    steps: [
      {
        suffix: "prepare",
        title: "Prepare the runbook",
        role: "ops-runner",
        grade: "G2",
        acceptance: [
          "Steps are ordered with explicit commands",
          "Rollback and stop conditions are defined",
          "Required access and blast radius are stated",
        ],
      },
      {
        suffix: "execute",
        title: "Execute the runbook",
        role: "ops-runner",
        grade: "G2",
        dependsOn: ["prepare"],
        acceptance: [
          "Each command result is recorded with an exit code",
          "System state after the change is verified",
          "Rollback is executed or confirmed unnecessary",
        ],
      },
    ],
  },
  review: {
    class: "review",
    label: "Review",
    summary: "Inspect without editing, then publish a verdict with file-level evidence.",
    capabilities: [],
    steps: [
      {
        suffix: "inspect",
        title: "Inspect the subject",
        role: "reviewer",
        grade: "G4",
        acceptance: [
          "Findings are ordered by severity",
          "Each finding points to a file, line or command",
          "No edits are made during inspection",
        ],
      },
      {
        suffix: "report",
        title: "Publish the review report",
        role: "writer",
        grade: "G2",
        dependsOn: ["inspect"],
        acceptance: [
          "The verdict is pass, rework or fail",
          "The report includes evidence for every finding",
          "Open questions are listed",
        ],
      },
    ],
  },
  planning: {
    class: "planning",
    label: "Planning",
    summary: "Map the problem into checkable units, then schedule milestones with a valid DAG.",
    capabilities: [],
    steps: [
      {
        suffix: "map",
        title: "Map the problem",
        role: "architect",
        grade: "G3",
        acceptance: [
          "Goal, constraints and stakeholders are stated",
          "Work is split into independently checkable units",
          "Risks have owners and mitigations",
        ],
      },
      {
        suffix: "schedule",
        title: "Schedule the work",
        role: "architect",
        grade: "G3",
        dependsOn: ["map"],
        acceptance: [
          "Milestones have acceptance criteria",
          "Dependencies form a valid DAG",
          "Cost and time estimates are bounded",
        ],
      },
    ],
  },
  creative: {
    class: "creative",
    label: "Creative exploration",
    summary: "Generate genuinely different directions, then choose one with explicit reasoning.",
    capabilities: [],
    steps: [
      {
        suffix: "explore",
        title: "Explore creative directions",
        role: "designer",
        grade: "G3",
        acceptance: [
          "At least three genuinely different directions are produced",
          "Each direction has a rationale and a sketch",
          "Brief constraints are respected",
        ],
      },
      {
        suffix: "select",
        title: "Select and justify a direction",
        role: "designer",
        grade: "G2",
        dependsOn: ["explore"],
        acceptance: [
          "One direction is chosen with reasoning",
          "Rejected directions are noted with reasons",
          "The next production step is concrete",
        ],
      },
    ],
  },
};

const MIXED_TEMPLATE: ClassTemplate = {
  class: "creative",
  label: "Mixed",
  summary: "Generic single-step delivery for work that does not fit one class.",
  capabilities: [],
  steps: [
    {
      suffix: "deliver",
      title: "Deliver the requested outcome",
      role: "implementer",
      grade: "G2",
      acceptance: [
        "The deliverable matches the goal",
        "Evidence is recorded for every claim",
        "Open questions are listed",
      ],
    },
  ],
};

export type TemplateRequest = {
  class: TaskClass;
  goal: string;
  prefix?: string;
  /** Overrides the role of every step. */
  role?: string;
  /** Extra capabilities appended to every step. */
  capabilities?: string[];
  expectedCostUsd?: number;
  notes?: string;
};

function sanitizePrefix(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 12) : "task";
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export function buildPlanTemplate(request: TemplateRequest): MissionPlan {
  const template = request.class === "mixed" ? MIXED_TEMPLATE : CLASS_TEMPLATES[request.class];
  const prefix = sanitizePrefix(request.prefix ?? (request.class === "mixed" ? "mix" : request.class));
  const extra = request.capabilities ?? [];

  const tasks: PlanTask[] = template.steps.map((step) => {
    const capabilities = dedupe([
      ...(request.class === "mixed" ? [] : template.capabilities),
      ...(step.capabilities ?? []),
      ...extra,
    ]);
    return {
      id: `${prefix}_${step.suffix}`,
      title: step.title,
      class: request.class,
      role: request.role ?? step.role,
      grade: step.grade,
      acceptance: [...step.acceptance],
      dependsOn: step.dependsOn?.map((suffix) => `${prefix}_${suffix}`) ?? [],
      ...(capabilities.length > 0 ? { capabilities } : {}),
    };
  });

  return validatePlan({
    goal: request.goal,
    tasks,
    expectedCostUsd: request.expectedCostUsd,
    notes: request.notes,
  });
}

export type TemplateSummary = {
  class: TaskClass;
  label: string;
  summary: string;
  capabilities: string[];
  steps: Array<{ suffix: string; title: string; role: string; grade: PlanGrade; dependsOn: string[] }>;
};

export function listTemplates(): TemplateSummary[] {
  const entries = Object.values(CLASS_TEMPLATES);
  return [
    ...entries.map((template) => ({
      class: template.class as TaskClass,
      label: template.label,
      summary: template.summary,
      capabilities: template.capabilities,
      steps: template.steps.map((step) => ({
        suffix: step.suffix,
        title: step.title,
        role: step.role,
        grade: step.grade,
        dependsOn: step.dependsOn ?? [],
      })),
    })),
    {
      class: "mixed" as TaskClass,
      label: MIXED_TEMPLATE.label,
      summary: MIXED_TEMPLATE.summary,
      capabilities: MIXED_TEMPLATE.capabilities,
      steps: MIXED_TEMPLATE.steps.map((step) => ({
        suffix: step.suffix,
        title: step.title,
        role: step.role,
        grade: step.grade,
        dependsOn: step.dependsOn ?? [],
      })),
    },
  ];
}
