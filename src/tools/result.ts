export function ok(payload: Record<string, unknown>) {
  return { content: JSON.stringify({ ok: true, ...payload }, null, 2) };
}

export function fail(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return { content: JSON.stringify({ ok: false, error: message }, null, 2) };
}
