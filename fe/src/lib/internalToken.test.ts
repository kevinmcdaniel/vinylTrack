// @vitest-environment node
// Server-only code: run in Node, not jsdom (jose rejects jsdom's cross-realm Uint8Array).
import { describe, it, expect } from 'vitest';
import { decodeJwt, jwtVerify } from 'jose';
import { signInternalToken } from './internalToken';

// Must match what be/src/common/internalToken.ts verifies (#73).
const SECRET = 'x'.repeat(32);
const key = new TextEncoder().encode(SECRET);

describe('signInternalToken', () => {
  it('signs a user token the BE will accept: HS256, aud vinyltrack-be, iss vinyltrack-fe, sub = user id', async () => {
    const token = await signInternalToken({ kind: 'user', userId: 'u-1' }, SECRET);
    const { payload, protectedHeader } = await jwtVerify(token, key, { audience: 'vinyltrack-be', issuer: 'vinyltrack-fe' });
    expect(protectedHeader.alg).toBe('HS256');
    expect(payload.sub).toBe('u-1');
  });

  it('signs a service token with sub service:fe', async () => {
    const token = await signInternalToken({ kind: 'service' }, SECRET);
    expect(decodeJwt(token).sub).toBe('service:fe');
  });

  it('lives about a minute, well inside the BE cap of 120 s', async () => {
    const { iat, exp } = decodeJwt(await signInternalToken({ kind: 'user', userId: 'u-1' }, SECRET));
    expect(exp! - iat!).toBeGreaterThan(0);
    expect(exp! - iat!).toBeLessThanOrEqual(60);
  });
});