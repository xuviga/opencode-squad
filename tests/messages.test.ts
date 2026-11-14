import { describe, expect, test } from "bun:test";
import { extractAssistantText, extractLastAssistantText } from "../src/runtime/messages";

const first = {
  type: "assistant",
  content: [{ type: "text", text: '{"report":1}' }],
};
const second = {
  type: "assistant",
  content: [
    { type: "reasoning", text: "thinking" },
    { type: "text", text: '{"report":2}' },
  ],
};

describe("assistant text extraction", () => {
  test("extractAssistantText joins every assistant text", () => {
    expect(extractAssistantText([first, second])).toBe('{"report":1}\n{"report":2}');
  });

  test("extractLastAssistantText returns only the latest report", () => {
    expect(extractLastAssistantText([first, second])).toBe('{"report":2}');
  });

  test("extractLastAssistantText ignores trailing messages without text", () => {
    expect(extractLastAssistantText([first, second, { type: "assistant", content: [] }])).toBe(
      '{"report":2}',
    );
  });
});
