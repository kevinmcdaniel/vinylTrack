import { describe, it, expect, vi } from 'vitest';
import { createGmailSender, TokenRevokedError } from '../gmail.js';

// Gmail API sender (#62), with Google stubbed.
const creds = { clientId: 'cid', clientSecret: 'csecret', refreshToken: 'rtoken' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const setup = () => {
  let now = 0;
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: `at-${fetch.mock.calls.length}`, expires_in: 3600 });
    return json({ id: 'msg-1' });
  });
  const sender = createGmailSender(creds, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => now });
  return { sender, fetch, advance: (ms: number) => { now += ms; } };
};

describe('createGmailSender', () => {
  it('exchanges the refresh token, then sends the raw message as me', async () => {
    const { sender, fetch } = setup();
    await sender.send('RAW');
    const [tokenUrl, tokenInit] = fetch.mock.calls[0]!;
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    expect(Object.fromEntries(new URLSearchParams(tokenInit!.body as string))).toEqual({
      grant_type: 'refresh_token', client_id: 'cid', client_secret: 'csecret', refresh_token: 'rtoken',
    });
    const [sendUrl, sendInit] = fetch.mock.calls[1]!;
    expect(sendUrl).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect((sendInit!.headers as Record<string, string>).Authorization).toBe('Bearer at-1');
    expect(JSON.parse(sendInit!.body as string)).toEqual({ raw: 'RAW' });
  });

  it('caches the access token until shortly before it expires', async () => {
    const { sender, fetch, advance } = setup();
    await sender.send('A');
    await sender.send('B');
    expect(fetch.mock.calls.filter(([u]) => u.startsWith('https://oauth2')).length).toBe(1);
    advance(3600_000 - 30_000); // inside the safety margin
    await sender.send('C');
    expect(fetch.mock.calls.filter(([u]) => u.startsWith('https://oauth2')).length).toBe(2);
  });

  it('turns invalid_grant (revoked token, password change) into TokenRevokedError', async () => {
    const fetch = vi.fn(async () => json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400));
    const sender = createGmailSender(creds, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => 0 });
    await expect(sender.checkToken()).rejects.toBeInstanceOf(TokenRevokedError);
  });

  it('throws when Gmail refuses the send', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.startsWith('https://oauth2') ? json({ access_token: 'at', expires_in: 3600 }) : json({ error: { code: 403 } }, 403));
    const sender = createGmailSender(creds, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => 0 });
    await expect(sender.send('RAW')).rejects.toThrow(/403/);
  });
});
