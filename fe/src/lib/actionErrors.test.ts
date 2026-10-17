import { describe, it, expect } from 'vitest';
import { actionErrorCode } from './actionErrors';
import { ApiError } from './apiError';

// A server action turns an expected BE refusal into one of a fixed set of
// codes for ?error=, never the BE's own message (#102): ?error= is
// user-controlled, so a page only ever looks a code up.
describe('actionErrorCode', () => {
  it.each([
    [406, 'invalid'],
    [409, 'in-use'],
    [403, 'forbidden'],
    [404, 'not-found'],
  ])('maps a %i to %s', (status, code) => {
    expect(actionErrorCode(new ApiError(status, '<b>anything</b>'))).toBe(code);
  });

  it.each([401, 500, 502])('rethrows a %i: not something a form can explain', (status) => {
    const error = new ApiError(status, 'boom');
    expect(() => actionErrorCode(error)).toThrow(error);
  });

  it('rethrows anything that is not an ApiError (a redirect, a network error)', () => {
    const error = new Error('NEXT_REDIRECT');
    expect(() => actionErrorCode(error)).toThrow(error);
  });
});
