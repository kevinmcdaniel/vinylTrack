// @vitest-environment node
// Server-only code: run in Node, not jsdom (jose rejects jsdom's cross-realm Uint8Array).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stubAppEnv } from '@/tests/env';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));

const { findCurrentUser, getCurrentUser } = await import('./session');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const user = { id: 'u-1', email: 'a@example.com', name: null, avatar: null, status: 'active', isAdmin: false };

// The session DAL (#73). A session the BE no longer knows must read as
// "not signed in" everywhere, or /sign-in and / bounce off each other forever.
describe('findCurrentUser', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('returns the BE user for a live session', async () => {
    auth.mockResolvedValue({ user: { id: 'u-1' } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, user));
    await expect(findCurrentUser()).resolves.toEqual(user);
  });

  it('returns null with no session, without calling the BE', async () => {
    auth.mockResolvedValue(null);
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(findCurrentUser()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 404])('returns null when the BE answers %i (user gone, secret rotated)', async (status) => {
    auth.mockResolvedValue({ user: { id: 'u-1' } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(status));
    await expect(findCurrentUser()).resolves.toBeNull();
  });

  it('throws on any other BE failure', async () => {
    auth.mockResolvedValue({ user: { id: 'u-1' } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(500));
    await expect(findCurrentUser()).rejects.toThrow(/500/);
  });
});

describe('getCurrentUser', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('sends a session the BE no longer knows to sign-in', async () => {
    auth.mockResolvedValue({ user: { id: 'u-1' } });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(401));
    await expect(getCurrentUser()).rejects.toThrow('REDIRECT /sign-in');
  });
});
