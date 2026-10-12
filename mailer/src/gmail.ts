// gmail.ts - send through the Gmail API as the sender mailbox (#62).
// OAuth refresh token (scope gmail.send only) → ~1 h access token, cached.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
// Refresh a minute early, so a token never expires mid-request.
const EXPIRY_MARGIN_MS = 60_000;
// If Google hangs, fail rather than hang /magic-link (and the BE sign-in behind it).
const TIMEOUT_MS = 10_000;

// The refresh token no longer works: revoked, expired, or the sender's
// password changed. Needs re-authorising (scripts/authorize.ts).
export class TokenRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenRevokedError';
  }
}

type Deps = { fetch: typeof globalThis.fetch; now: () => number };

export function createGmailSender(
  creds: { clientId: string; clientSecret: string; refreshToken: string },
  { fetch, now }: Deps = { fetch: globalThis.fetch, now: Date.now },
) {
  let cached: { token: string; expiresAt: number } | undefined;

  async function accessToken(force = false): Promise<string> {
    if (!force && cached && now() < cached.expiresAt - EXPIRY_MARGIN_MS) return cached.token;
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: creds.refreshToken,
      }).toString(),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (body.error === 'invalid_grant') throw new TokenRevokedError('Gmail refresh token was revoked or has expired');
    if (!res.ok || !body.access_token) throw new Error(`Gmail token exchange failed (${res.status}${body.error ? `: ${body.error}` : ''})`);
    cached = { token: body.access_token, expiresAt: now() + (body.expires_in ?? 3600) * 1000 };
    return cached.token;
  }

  return {
    // Health check: proves the refresh token still works.
    async checkToken(): Promise<void> {
      await accessToken(true);
    },
    async send(raw: string): Promise<void> {
      const attempt = async (token: string) =>
        fetch(SEND_URL, {
          method: 'POST',
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
      let res = await attempt(await accessToken());
      // A cached token Google no longer accepts: refresh once and retry.
      if (res.status === 401) res = await attempt(await accessToken(true));
      if (!res.ok) throw new Error(`Gmail send failed (${res.status})`);
    },
  };
}
export type GmailSender = ReturnType<typeof createGmailSender>;
