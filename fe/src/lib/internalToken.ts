import 'server-only';
import { SignJWT } from 'jose';

/**
 * The bearer token on every FE→BE call (#73). Must match what
 * be/src/common/internalToken.ts verifies: HS256 over internal_api_secret,
 * aud vinyltrack-be, iss vinyltrack-fe, ~60 s. A user token names the user;
 * a service token (sub service:fe) is the FE acting as itself, e.g. sign-in.
 */
export type InternalIdentity = { kind: 'user'; userId: string } | { kind: 'service' };

export function signInternalToken(identity: InternalIdentity, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(identity.kind === 'user' ? identity.userId : 'service:fe')
    .setAudience('vinyltrack-be')
    .setIssuer('vinyltrack-fe')
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret));
}
