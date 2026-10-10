// internalToken.ts - the FE→BE bearer token (#73).
//
// The FE (Auth.js, JWT sessions) never touches the database. Each call it
// makes to the BE carries a short-lived HS256 token signed with
// internal_api_secret, which only the fe and be containers mount:
//   user token:    sub = user.id       → identifyUser loads and checks the user
//   service token: sub = "service:fe"  → the FE acting as itself, e.g. sign-in
//                                         before any user exists
import { jwtVerify, SignJWT } from 'jose';

export const INTERNAL_TOKEN_AUDIENCE = 'vinyltrack-be';
export const INTERNAL_TOKEN_ISSUER = 'vinyltrack-fe';
const SERVICE_SUBJECT = 'service:fe';
const LIFETIME_SECONDS = 60;
const MAX_LIFETIME_SECONDS = 120;

export type InternalIdentity = { kind: 'user'; userId: string } | { kind: 'service' };

const keyFor = (secret: string) => new TextEncoder().encode(secret);

export async function signInternalToken(identity: InternalIdentity, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(identity.kind === 'user' ? identity.userId : SERVICE_SUBJECT)
    .setAudience(INTERNAL_TOKEN_AUDIENCE)
    .setIssuer(INTERNAL_TOKEN_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${LIFETIME_SECONDS}s`)
    .sign(keyFor(secret));
}

// Throws on anything but a well-formed, correctly signed, current token.
export async function verifyInternalToken(token: string, secret: string): Promise<InternalIdentity> {
  const { payload } = await jwtVerify(token, keyFor(secret), {
    algorithms: ['HS256'],
    audience: INTERNAL_TOKEN_AUDIENCE,
    issuer: INTERNAL_TOKEN_ISSUER,
    requiredClaims: ['sub', 'iat', 'exp'],
  });
  // A leaked token should be useless almost immediately, so refuse long-lived ones.
  if (payload.exp! - payload.iat! > MAX_LIFETIME_SECONDS) throw new Error('internal token lifetime too long');
  if (!payload.sub) throw new Error('internal token has no subject');
  return payload.sub === SERVICE_SUBJECT ? { kind: 'service' } : { kind: 'user', userId: payload.sub };
}
