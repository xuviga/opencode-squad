import { describe, expect, test } from "bun:test";
import { parseRulingText, validateRuling } from "../src/ruling";

const valid = {
  winner: "worker",
  reasoning: "The reviewer's finding is contradicted by the diff.",
  actions: ["re-review the task"],
};

describe("validateRuling", () => {
  test("accepts a valid ruling", () => {
    expect(validateRuling(valid).winner).toBe("worker");
  });

  test("rejects an unknown winner", () => {
    expect(() => validateRuling({ ...valid, winner: "boss" })).toThrow("ruling.winner");
  });

  test("rejects empty reasoning", () => {
    expect(() => validateRuling({ ...valid, reasoning: "   " })).toThrow("ruling.reasoning");
  });

  test("parses concatenated JSON and takes the last ruling", () => {
    const text =
      JSON.stringify({ ...valid, winner: "reviewer" }) + "\n" + JSON.stringify(valid);
    expect(parseRulingText(text).winner).toBe("worker");
  });
});
