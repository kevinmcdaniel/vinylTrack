// @vitest-environment node
// Server-only code: run in Node, not jsdom (jose rejects jsdom's cross-realm Uint8Array).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stubAppEnv } from '@/tests/env';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));
vi.mock('@/auth', () => ({ signOut: vi.fn() }));
vi.mock('@/lib/session', () => ({ requireSessionUserId: vi.fn(async () => 'u-1') }));

const { requestAccessAgain } = await import('./actions');

const reply = (status: number) =>
  new Response(JSON.stringify({ data: null, status, message: 'BE says no' }), { status, headers: { 'content-type': 'application/json' } });
const form = () => { const f = new FormData(); f.set('turnstileToken', 'tok'); return f; };

// A declined user asks again (#73). The BE's answer decides what they see next.
describe('requestAccessAgain', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('goes back to the waiting screen when the BE accepts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: {}, status: 200 }), { status: 200 }));
    await expect(requestAccessAgain(form())).rejects.toThrow(/^REDIRECT \/pending$/);
  });

  it.each([401, 406, 409])('shows an error code, not a silent "declined" again, when the BE answers %i', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(status));
    await expect(requestAccessAgain(form())).rejects.toThrow(/^REDIRECT \/pending\?error=request-failed$/);
  });

  it('throws on a BE failure rather than pretending it worked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(503));
    await expect(requestAccessAgain(form())).rejects.toThrow(/503/);
  });
});
