import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { signInternalToken, verifyInternalToken, INTERNAL_TOKEN_AUDIENCE, INTERNAL_TOKEN_ISSUER } from '../common/internalToken.js';

// The FE→BE bearer token (#73): HS256 over internal_api_secret, short-lived.
const SECRET = 'x'.repeat(32);
const key = new TextEncoder().encode(SECRET);
const now = () => Math.floor(Date.now() / 1000);

const raw = (claims: Record<string, unknown>, opts: { alg?: string; iat?: number; exp?: number; aud?: string; iss?: string; secret?: Uint8Array } = {}) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: opts.alg ?? 'HS256' })
    .setIssuedAt(opts.iat ?? now())
    .setExpirationTime(opts.exp ?? now() + 60)
    .setAudience(opts.aud ?? INTERNAL_TOKEN_AUDIENCE)
    .setIssuer(opts.iss ?? INTERNAL_TOKEN_ISSUER)
    .sign(opts.secret ?? key);

describe('internal token', () => {
  it('round-trips a user token', async () => {
    const token = await signInternalToken({ kind: 'user', userId: 'u-1' }, SECRET);
    await expect(verifyInternalToken(token, SECRET)).resolves.toEqual({ kind: 'user', userId: 'u-1' });
  });

  it('round-trips a service token, which names no user', async () => {
    const token = await signInternalToken({ kind: 'service' }, SECRET);
    await expect(verifyInternalToken(token, SECRET)).resolves.toEqual({ kind: 'service' });
  });

  it.each([
    ['signed with another secret', () => raw({ sub: 'u-1' }, { secret: new TextEncoder().encode('y'.repeat(32)) })],
    ['expired', () => raw({ sub: 'u-1' }, { iat: now() - 120, exp: now() - 10 })],
    ['for another audience', () => raw({ sub: 'u-1' }, { aud: 'someone-else' })],
    ['from another issuer', () => raw({ sub: 'u-1' }, { iss: 'someone-else' })],
    ['valid for longer than 120 seconds', () => raw({ sub: 'u-1' }, { exp: now() + 3600 })],
    ['missing its subject', () => raw({})],
  ])('rejects a token %s', async (_label, make) => {
    await expect(verifyInternalToken(await make(), SECRET)).rejects.toThrow();
  });

  it('rejects an unsigned (alg: none) token', async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${enc({ alg: 'none' })}.${enc({ sub: 'u-1', aud: INTERNAL_TOKEN_AUDIENCE, iss: INTERNAL_TOKEN_ISSUER, iat: now(), exp: now() + 60 })}.`;
    await expect(verifyInternalToken(unsigned, SECRET)).rejects.toThrow();
  });

  it('rejects garbage', async () => {
    await expect(verifyInternalToken('not-a-jwt', SECRET)).rejects.toThrow();
  });
});
