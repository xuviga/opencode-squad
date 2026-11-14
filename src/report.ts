import { parseLastJsonObject } from "./json";

export const REPORT_STATUSES = ["done", "blocked", "failed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type ReportEvidence = {
  command?: string;
  exit?: number;
  tail?: string;
};

export type TaskReport = {
  status: ReportStatus;
  summary: string;
  artifacts?: Record<string, unknown>;
  evidence?: ReportEvidence[];
  risks?: string[];
  open_questions?: string[];
};

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown, path: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value.map((item, index) => {
    if (typeof item !== "string") throw new Error(`${path}[${index}] must be a string`);
    return item;
  });
}

export function validateReport(value: unknown): TaskReport {
  const report = asRecord(value, "report");
  const status = report.status;
  if (typeof status !== "string" || !(REPORT_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`report.status must be one of ${REPORT_STATUSES.join(", ")}`);
  }
  if (typeof report.summary !== "string" || report.summary.trim().length === 0) {
    throw new Error("report.summary must be a non-empty string");
  }

  const artifacts =
    report.artifacts === undefined ? undefined : asRecord(report.artifacts, "report.artifacts");

  const evidence =
    report.evidence === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(report.evidence)) throw new Error("report.evidence must be an array");
          return report.evidence.map((item, index) => {
            const entry = asRecord(item, `report.evidence[${index}]`);
            const result: ReportEvidence = {};
            if (entry.command !== undefined) {
              if (typeof entry.command !== "string") {
                throw new Error(`report.evidence[${index}].command must be a string`);
              }
              result.command = entry.command;
            }
            if (entry.exit !== undefined) {
              if (typeof entry.exit !== "number") {
                throw new Error(`report.evidence[${index}].exit must be a number`);
              }
              result.exit = entry.exit;
            }
            if (entry.tail !== undefined) {
              if (typeof entry.tail !== "string") {
                throw new Error(`report.evidence[${index}].tail must be a string`);
              }
              result.tail = entry.tail;
            }
            return result;
          });
        })();

  return {
    status: status as ReportStatus,
    summary: report.summary.trim(),
    artifacts,
    evidence,
    risks: asStringArray(report.risks, "report.risks"),
    open_questions: asStringArray(report.open_questions, "report.open_questions"),
  };
}

export function parseReportText(text: string): TaskReport {
  const parsed = parseLastJsonObject(text, "worker report");
  return validateReport(parsed);
}
