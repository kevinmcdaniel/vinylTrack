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
vi.mock('@/lib/session', () => ({ requireAdmin: vi.fn(async () => ({ id: 'admin', isAdmin: true })) }));
vi.mock('server-only', () => ({}));

const { approveRequest, denyRequest } = await import('./actions');
const { ApiError } = await import('@/lib/api');

const form = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };

describe.each([
  ['approveRequest', approveRequest, form({ userId: 'u-1', ownerId: 'o-1' })],
  ['denyRequest', denyRequest, form({ userId: 'u-1' })],
] as const)('%s', (_name, action, data) => {
  afterEach(() => apiPost.mockReset());

  it('reloads the list on success', async () => {
    apiPost.mockResolvedValue({});
    await expect(action(data)).rejects.toThrow(/^REDIRECT \/admin\/requests$/);
  });

  it.each([
    [409, 'conflict'],
    [404, 'gone'],
  ])('turns a BE %i into ?error=%s instead of an error page', async (status, code) => {
    apiPost.mockRejectedValue(new ApiError(status, 'nope'));
    await expect(action(data)).rejects.toThrow(new RegExp(`^REDIRECT /admin/requests\\?error=${code}$`));
  });

  it('still throws on anything else', async () => {
    apiPost.mockRejectedValue(new ApiError(500, 'boom'));
    await expect(action(data)).rejects.toThrow('boom');
  });
});
