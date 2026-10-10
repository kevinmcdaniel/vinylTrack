// Express 5 types `req.params[key]` as `string | string[]` (repeated-param
// support). Our routes only use single-value params, so collapse to a string.
export const routeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

// Request bodies are checked against an explicit allowlist (#11): an unexpected
// field is a 406, never silently ignored, so nobody can sneak in e.g.
// `allowAutomation` or `isAdmin` and believe it took effect.
export const assertOnlyFields = (body: unknown, allowed: readonly string[], makeError: (message: string) => Error): void => {
  if (body === undefined || body === null) return;
  if (typeof body !== 'object' || Array.isArray(body)) throw makeError('Request body must be a JSON object.');
  const unexpected = Object.keys(body).filter((k) => !allowed.includes(k));
  if (unexpected.length > 0) throw makeError(`Unexpected field(s): ${unexpected.join(', ')}.`);
};
