export function extractAssistantText(messages: readonly unknown[]): string {
  const parts: string[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const record = message as { type?: string; content?: unknown };
    if (record.type !== "assistant" || !Array.isArray(record.content)) continue;
    for (const part of record.content) {
      if (!part || typeof part !== "object") continue;
      const content = part as { type?: string; text?: unknown };
      if (content.type === "text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

/**
 * Returns the text of the last assistant message that has text content.
 * A rework session contains the previous round's messages; taking only the
 * last assistant text avoids concatenating two reports into invalid JSON.
 */
export function extractLastAssistantText(messages: readonly unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = extractAssistantText([messages[index]]);
    if (text.length > 0) return text;
  }
  return "";
}
