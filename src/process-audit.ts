import { parseLastJsonObject } from "./json";

export type ProcessFinding = {
  id: string;
  claim: string;
  evidence: string;
  required_fix: string;
};

export type ProcessAudit = {
  status: "pass" | "fail";
  summary: string;
  findings: ProcessFinding[];
};

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

export function validateProcessAudit(value: unknown): ProcessAudit {
  const audit = asRecord(value, "process_audit");
  if (audit.status !== "pass" && audit.status !== "fail") {
    throw new Error("process_audit.status must be pass or fail");
  }
  if (!Array.isArray(audit.findings)) {
    throw new Error("process_audit.findings must be an array");
  }
  const findings = audit.findings.map((raw, index) => {
    const finding = asRecord(raw, `process_audit.findings[${index}]`);
    return {
      id: asString(finding.id, `process_audit.findings[${index}].id`),
      claim: asString(finding.claim, `process_audit.findings[${index}].claim`),
      evidence: asString(finding.evidence, `process_audit.findings[${index}].evidence`),
      required_fix: asString(
        finding.required_fix,
        `process_audit.findings[${index}].required_fix`,
      ),
    };
  });
  if (audit.status === "fail" && findings.length === 0) {
    throw new Error("process fail requires at least one finding");
  }
  return {
    status: audit.status,
    summary: asString(audit.summary, "process_audit.summary"),
    findings,
  };
}

export function parseProcessAuditText(text: string): ProcessAudit {
  return validateProcessAudit(parseLastJsonObject(text, "process audit"));
}
