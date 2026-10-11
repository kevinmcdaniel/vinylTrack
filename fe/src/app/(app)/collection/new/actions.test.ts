// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import type * as ApiModule from '@/lib/api';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));
const apiPost = vi.fn();
vi.mock('@/lib/api', async () => {
  const { ApiError } = await vi.importActual<typeof ApiModule>('@/lib/api');
  return { ApiError, apiPost: (...args: unknown[]) => apiPost(...args) };
});
vi.mock('server-only', () => ({}));
// api.ts imports the session DAL, which pulls in Auth.js; not under test here.
vi.mock('@/lib/session', () => ({ requireActiveUser: vi.fn() }));

const { createCollection } = await import('./actions');
const { ApiError } = await import('@/lib/api');

const form = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };

describe('createCollection', () => {
  afterEach(() => apiPost.mockReset());

  it('opens the new collection', async () => {
    apiPost.mockResolvedValue({ id: 'c-9' });
    await expect(createCollection(form({ name: 'Vinyl', kind: 'physical' }))).rejects.toThrow('REDIRECT /collection/c-9');
  });

  // The BE's message never reaches the URL: a crafted ?error= could otherwise
  // put any text in the alert.
  it('redirects a 406 with an error code, not the BE message', async () => {
    apiPost.mockRejectedValue(new ApiError(406, '<b>kind</b> must be physical or digital'));
    await expect(createCollection(form({ name: 'x', kind: 'bogus' }))).rejects.toThrow(/^REDIRECT \/collection\/new\?error=invalid$/);
  });
});
