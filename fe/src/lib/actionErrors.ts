import { ApiError } from './apiError';

/**
 * The fixed codes a write form understands in `?error=` (#102). A server action
 * maps an expected BE refusal to one of these and redirects with it; the page
 * looks the code up in its own message table. The BE's message never reaches
 * the URL, because `?error=` is user-controlled.
 */
export type ActionErrorCode = 'invalid' | 'in-use' | 'forbidden' | 'not-found';

const CODES: Partial<Record<number, ActionErrorCode>> = {
  406: 'invalid',
  409: 'in-use',
  403: 'forbidden',
  404: 'not-found',
};

/** Map an expected refusal to its code; rethrow anything a form can't explain. */
export function actionErrorCode(error: unknown): ActionErrorCode {
  const code = error instanceof ApiError ? CODES[error.status] : undefined;
  if (!code) throw error;
  return code;
}
