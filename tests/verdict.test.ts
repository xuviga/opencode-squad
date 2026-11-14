import { describe, expect, test } from "bun:test";
import { parseVerdictText, requiredChecks, validateVerdict } from "../src/verdict";

const pass = {
  verdict: "pass",
  severity: "low",
  findings: [],
  checked: ["diff", "tests", "acceptance"],
};

const fail = {
  verdict: "fail",
  severity: "high",
  findings: [
    {
      id: "F1",
      claim: "Deliverable missing",
      evidence: "report.json:1",
      required_fix: "Add the deliverable",
    },
  ],
  checked: ["diff", "acceptance"],
};

describe("validateVerdict", () => {
  test("accepts a pass with diff and tests", () => {
    expect(validateVerdict(pass).verdict).toBe("pass");
  });

  test("in-place code tasks require diff and acceptance, not tests", () => {
    expect(requiredChecks("code", { isolation: "none" })).toEqual(["diff", "acceptance"]);
    const inPlacePass = {
      ...pass,
      checked: ["diff", "acceptance"],
    };
    expect(
      validateVerdict(inPlacePass, "code", { isolation: "none" }).verdict,
    ).toBe("pass");
    expect(() => validateVerdict(inPlacePass, "code")).toThrow(
      "pass verdict requires checked: tests",
    );
  });

  test("worktree research tasks still use acceptance and evidence", () => {
    expect(requiredChecks("research")).toEqual(["acceptance", "evidence"]);
    expect(requiredChecks("research", { isolation: "none" })).toEqual([
      "acceptance",
      "evidence",
    ]);
  });

  test("rejects a fail with low severity", () => {
    expect(() => validateVerdict({ ...fail, severity: "medium" })).toThrow(
      "severity high or critical",
    );
  });

  test("accepts a fail with an evidenced finding", () => {
    expect(validateVerdict(fail).findings).toHaveLength(1);
  });

  test("rejects a fail without findings", () => {
    expect(() => validateVerdict({ ...fail, findings: [] })).toThrow("requires at least one finding");
  });

  test("rejects a pass without tests", () => {
    expect(() => validateVerdict({ ...pass, checked: ["diff"] })).toThrow("requires checked: tests");
  });

  test("parses concatenated JSON and takes the last verdict", () => {
    const text = `${JSON.stringify(fail)}\n${JSON.stringify(pass)}`;
    expect(parseVerdictText(text).verdict).toBe("pass");
  });

  test("code class requires diff and tests", () => {
    expect(validateVerdict(pass, "code").verdict).toBe("pass");
    expect(() => validateVerdict({ ...pass, checked: ["diff"] }, "code")).toThrow(
      "requires checked: tests",
    );
  });

  test("research class passes on acceptance and evidence without a diff", () => {
    const research = { ...pass, checked: ["acceptance", "evidence"] };
    expect(validateVerdict(research, "research").verdict).toBe("pass");
    expect(() => validateVerdict({ ...pass, checked: ["acceptance"] }, "writing")).toThrow(
      "requires checked: evidence",
    );
  });
});
