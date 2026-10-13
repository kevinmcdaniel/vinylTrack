import 'server-only';
import type { Adapter, VerificationToken } from 'next-auth/adapters';
import { servicePost } from './serviceApi';

/**
 * Auth.js adapter for magic links (#74). The email provider insists on one,
 * but the FE still never touches the database: verification tokens (already
 * hashed by Auth.js) are stored and spent through the BE.
 *
 * Users are not the adapter's business. The signIn callback (src/auth.ts)
 * resolves the real user through BE sign-in and puts its id on `user`, so
 * getUserByEmail always misses and createUser just hands that user back.
 */
const toToken = (data: { identifier: string; token: string; expires: string }): VerificationToken => ({
  identifier: data.identifier,
  token: data.token,
  expires: new Date(data.expires),
});

async function post(path: string, body: unknown) {
  const res = await servicePost(path, body);
  if (!res.ok) {
    console.error('auth adapter', path, res.status);
    throw new Error(`Auth adapter: BE answered ${res.status} for ${path}`);
  }
  return (await res.json()).data;
}

export const authAdapter: Adapter = {
  async createVerificationToken({ identifier, token, expires }) {
    return toToken(await post('/auth/verification-token', { identifier, token, expires: expires.toISOString() }));
  },
  async useVerificationToken({ identifier, token }) {
    const data = await post('/auth/verification-token/use', { identifier, token });
    return data ? toToken(data) : null;
  },
  getUserByEmail: async () => null,
  getUser: async () => null,
  createUser: async (user) => user,
};
