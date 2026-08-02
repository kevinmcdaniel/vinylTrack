// Express 5 types `req.params[key]` as `string | string[]` (repeated-param
// support). Our routes only use single-value params, so collapse to a string.
export const routeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
