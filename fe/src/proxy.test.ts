// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
// The docs call it unstable_doesProxyMatch; this Next still ships the middleware name.
import { getRedirectUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import nextConfig from '../next.config';
import { config, proxy, SESSION_COOKIES } from './proxy';
// Auth.js's own cookie names, so ours can't drift from them on an upgrade.
import { defaultCookies } from '../node_modules/@auth/core/lib/utils/cookie.js';

const BASE = 'https://vinyl.example.com';
const request = (path: string, cookies: Record<string, string> = {}) =>
  new NextRequest(`${BASE}${path}`, {
    headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') },
  });
const runsOn = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig, url });

// Optimistic sign-in check (#94): a signed-out request gets a real 307 before
// (app)/loading.tsx can stream a 200. lib/session.ts stays the real gate.
describe('proxy', () => {
  it('uses the session cookie names Auth.js sets, plain and __Secure-', () => {
    expect(SESSION_COOKIES).toEqual([defaultCookies(false).sessionToken.name, defaultCookies(true).sessionToken.name]);
  });

  it.each([['/'], ['/help'], ['/collection/new'], ['/admin'], ['/collection/abc?q=x'], ['/pending'], ['/docs/hosting-deploy']])(
    'sends a signed-out %s to /sign-in with a 307',
    (path) => {
      const res = proxy(request(path));
      expect(res.status).toBe(307);
      expect(getRedirectUrl(res)).toBe(`${BASE}/sign-in`);
    },
  );

  it.each(SESSION_COOKIES.flatMap((name) => [[name], [`${name}.0`]]))('lets a request with %s through', (name) => {
    const res = proxy(request('/help', { [name]: 'opaque' }));
    expect(res.status).toBe(200);
    expect(getRedirectUrl(res)).toBeNull();
  });

  // A server action from a tab left open past cookie expiry: a 307 keeps the
  // POST and its action id, so the client would get "failed to find server
  // action" instead of the sign-in page. Let it through; the DAL's redirect()
  // comes back as an action redirect, as before (PR #100 review).
  it('lets a server action POST through without a cookie', () => {
    const req = new NextRequest(`${BASE}/help`, { method: 'POST', headers: { 'next-action': 'abc123' } });
    const res = proxy(req);
    expect(res.status).toBe(200);
    expect(getRedirectUrl(res)).toBeNull();
  });

  it('still redirects a plain POST without a cookie', () => {
    expect(proxy(new NextRequest(`${BASE}/help`, { method: 'POST' })).status).toBe(307);
  });

  it('ignores other Auth.js cookies', () => {
    expect(proxy(request('/help', { 'authjs.csrf-token': 'x', 'authjs.callback-url': 'y' })).status).toBe(307);
  });

  it.each([['/'], ['/help'], ['/help/getting-started'], ['/collection/new'], ['/admin/requests'], ['/pending'], ['/docs'], ['/sign-inside']])(
    'runs on %s',
    (url) => expect(runsOn(url)).toBe(true),
  );

  // Public: signing in, Auth.js's own routes, the compose healthcheck, assets.
  it.each([
    ['/sign-in'], ['/sign-in/check-email'], ['/api/auth/signin'], ['/api/auth/callback/google'],
    ['/api/health'], ['/_next/static/chunks/app.js'], ['/_next/image?url=x'], ['/favicon.ico'],
  ])('skips %s', (url) => expect(runsOn(url)).toBe(false));
});
