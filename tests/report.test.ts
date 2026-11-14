import { describe, expect, test } from "bun:test";
import { parseReportText, validateReport } from "../src/report";

const validReport = {
  status: "done",
  summary: "Fixed pagination",
  artifacts: { files: ["src/orders/list.ts"] },
  evidence: [{ command: "bun test orders", exit: 0, tail: "ok" }],
  risks: [],
  open_questions: [],
};

describe("validateReport", () => {
  test("accepts a valid report", () => {
    const report = validateReport(validReport);
    expect(report.status).toBe("done");
    expect(report.evidence?.[0]?.command).toBe("bun test orders");
  });

  test("rejects an unknown status", () => {
    expect(() => validateReport({ ...validReport, status: "maybe" })).toThrow(
      "report.status",
    );
  });

  test("rejects an empty summary", () => {
    expect(() => validateReport({ ...validReport, summary: "   " })).toThrow(
      "report.summary",
    );
  });

  test("parses JSON surrounded by markdown fences", () => {
    const report = parseReportText(`\`\`\`json\n${JSON.stringify(validReport)}\n\`\`\``);
    expect(report.summary).toBe("Fixed pagination");
  });

  test("parses concatenated JSON and takes the last report", () => {
    const text =
      JSON.stringify({ ...validReport, summary: "first" }) +
      "\n" +
      JSON.stringify({ ...validReport, summary: "second" });
    expect(parseReportText(text).summary).toBe("second");
  });

  test("rejects text without JSON", () => {
    expect(() => parseReportText("no json here")).toThrow("no JSON object");
  });
});
