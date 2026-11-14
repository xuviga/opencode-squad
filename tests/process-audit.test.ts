import { describe, expect, test } from "bun:test";
import { parseProcessAuditText, validateProcessAudit } from "../src/process-audit";

const pass = {
  status: "pass",
  summary: "Process is consistent",
  findings: [],
};

const fail = {
  status: "fail",
  summary: "Missing evidence",
  findings: [
    {
      id: "P1",
      claim: "Task integrated without evidence",
      evidence: "tasks[0].report.evidence",
      required_fix: "Attach evidence",
    },
  ],
};

describe("validateProcessAudit", () => {
  test("accepts a pass", () => {
    expect(validateProcessAudit(pass).status).toBe("pass");
  });

  test("accepts a fail with a finding", () => {
    expect(validateProcessAudit(fail).findings).toHaveLength(1);
  });

  test("rejects a fail without findings", () => {
    expect(() => validateProcessAudit({ ...fail, findings: [] })).toThrow(
      "process fail requires",
    );
  });

  test("parses concatenated JSON and takes the last audit", () => {
    const text = JSON.stringify(fail) + "\n" + JSON.stringify(pass);
    expect(parseProcessAuditText(text).status).toBe("pass");
  });
});
