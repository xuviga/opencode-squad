/**
 * Finds the last JSON object in text. Handles markdown fences and
 * concatenated objects from a rework session by trying each `{` from the end.
 */
export function parseLastJsonObject(text: string, subject: string): unknown {
  const end = text.lastIndexOf("}");
  if (end < 0) throw new Error(`no JSON object found in the ${subject}`);

  const starts: number[] = [];
  for (let index = text.indexOf("{"); index !== -1; index = text.indexOf("{", index + 1)) {
    starts.push(index);
  }
  if (starts.length === 0) throw new Error(`no JSON object found in the ${subject}`);

  let lastError: unknown;
  for (let index = starts.length - 1; index >= 0; index -= 1) {
    const start = starts[index]!;
    if (start >= end) continue;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `${subject} is not valid JSON: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
