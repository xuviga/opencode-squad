import { parseLastJsonObject } from "./json";

export const VERDICT_OUTCOMES = ["pass", "fail"] as const;
export type VerdictOutcome = (typeof VERDICT_OUTCOMES)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export type Finding = {
  id: string;
  claim: string;
  evidence: string;
  required_fix: string;
};

export type Verdict = {
  verdict: VerdictOutcome;
  severity: Severity;
  findings: Finding[];
  checked: string[];
};

/** Classes whose deliverable is a diff plus executable checks. */
const DIFF_CLASSES = new Set(["code", "data", "ops"]);

export type CheckContext = {
  isolation?: "worktree" | "none";
};

/**
 * A pass verdict must prove the acceptance criteria by class. Code-like work
 * needs a diff and test evidence; research, writing, design and similar work
 * has no diff, so the report evidence and acceptance checks carry the proof.
 *
 * In in-place isolation there is no commit and often no test runner, so
 * code-like tasks are judged by the filesystem diff plus acceptance criteria.
 */
export function requiredChecks(taskClass?: string, context: CheckContext = {}): string[] {
  if (context.isolation === "none") {
    return taskClass !== undefined && DIFF_CLASSES.has(taskClass)
      ? ["diff", "acceptance"]
      : ["acceptance", "evidence"];
  }
  if (taskClass === undefined) return ["diff", "tests"];
  return DIFF_CLASSES.has(taskClass) ? ["diff", "tests"] : ["acceptance", "evidence"];
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

export function validateVerdict(
  value: unknown,
  taskClass?: string,
  context: CheckContext = {},
): Verdict {
  const verdict = asRecord(value, "verdict");
  const outcome = verdict.verdict;
  if (typeof outcome !== "string" || !(VERDICT_OUTCOMES as readonly string[]).includes(outcome)) {
    throw new Error(`verdict.verdict must be one of ${VERDICT_OUTCOMES.join(", ")}`);
  }

  const severity = verdict.severity;
  if (typeof severity !== "string" || !(SEVERITIES as readonly string[]).includes(severity)) {
    throw new Error(`verdict.severity must be one of ${SEVERITIES.join(", ")}`);
  }

  if (!Array.isArray(verdict.findings)) {
    throw new Error("verdict.findings must be an array");
  }
  const findings: Finding[] = verdict.findings.map((raw, index) => {
    const finding = asRecord(raw, `verdict.findings[${index}]`);
    return {
      id: asString(finding.id, `verdict.findings[${index}].id`),
      claim: asString(finding.claim, `verdict.findings[${index}].claim`),
      evidence: asString(finding.evidence, `verdict.findings[${index}].evidence`),
      required_fix: asString(finding.required_fix, `verdict.findings[${index}].required_fix`),
    };
  });

  if (!Array.isArray(verdict.checked) || verdict.checked.some((item) => typeof item !== "string")) {
    throw new Error("verdict.checked must be an array of strings");
  }
  const checked = verdict.checked.map((item) => String(item).toLowerCase());

  if (outcome === "fail" && findings.length === 0) {
    throw new Error("fail verdict requires at least one finding with evidence");
  }
  if (outcome === "pass") {
    for (const required of requiredChecks(taskClass, context)) {
      if (!checked.includes(required)) {
        throw new Error(`pass verdict requires checked: ${required}`);
      }
    }
  }

  return {
    verdict: outcome as VerdictOutcome,
    severity: severity as Severity,
    findings,
    checked: verdict.checked.map((item) => String(item)),
  };
}

export function parseVerdictText(
  text: string,
  taskClass?: string,
  context: CheckContext = {},
): Verdict {
  const parsed = parseLastJsonObject(text, "reviewer verdict");
  return validateVerdict(parsed, taskClass, context);
}
