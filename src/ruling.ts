import { parseLastJsonObject } from "./json";

export const RULING_WINNERS = ["worker", "reviewer", "split"] as const;
export type RulingWinner = (typeof RULING_WINNERS)[number];

export type Ruling = {
  winner: RulingWinner;
  reasoning: string;
  actions: string[];
};

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function validateRuling(value: unknown): Ruling {
  const ruling = asRecord(value, "ruling");
  const winner = ruling.winner;
  if (typeof winner !== "string" || !(RULING_WINNERS as readonly string[]).includes(winner)) {
    throw new Error(`ruling.winner must be one of ${RULING_WINNERS.join(", ")}`);
  }
  if (typeof ruling.reasoning !== "string" || ruling.reasoning.trim().length === 0) {
    throw new Error("ruling.reasoning must be a non-empty string");
  }
  if (!Array.isArray(ruling.actions) || ruling.actions.some((item) => typeof item !== "string")) {
    throw new Error("ruling.actions must be an array of strings");
  }
  return {
    winner: winner as RulingWinner,
    reasoning: ruling.reasoning.trim(),
    actions: ruling.actions.map((item) => String(item)),
  };
}

export function parseRulingText(text: string): Ruling {
  return validateRuling(parseLastJsonObject(text, "arbiter ruling"));
}
