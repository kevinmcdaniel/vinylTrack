// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants';
import configFor from './next.config';

const prod = configFor(PHASE_PRODUCTION_BUILD);
const dev = configFor(PHASE_DEVELOPMENT_SERVER);

const ruleFor = async (config: typeof prod, source: string) => {
  const rule = (await config.headers!()).find((r) => r.source === source);
  expect(rule, `a headers rule for ${source}`).toBeDefined();
  return new Map(rule!.headers.map((h) => [h.key, h.value]));
};
const headersOf = (config: typeof prod) => ruleFor(config, '/:path*');
const directives = (policy: string) =>
  new Map(policy.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [name, ...values] = d.split(/\s+/);
    return [name!, values] as const;
  }));

describe('next.config', () => {
  // #129 item 3: nothing uses next/image, and proxy.ts lets /_next/image
  // through unauthenticated, so the optimizer stays off.
  it('turns the image optimizer off', () => {
    expect(prod.images?.unoptimized).toBe(true);
  });

  // #9: a stale service worker would pin every phone to an old release, so
  // the browser must always ask for /sw.js fresh.
  it('serves /sw.js uncached, as JavaScript, for the whole site', async () => {
    const sw = await ruleFor(prod, '/sw.js');
    expect(sw.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
    expect(sw.get('Content-Type')).toBe('application/javascript; charset=utf-8');
    expect(sw.get('Service-Worker-Allowed')).toBe('/');
  });

  it('keeps the standalone output the production image ships', () => {
    expect(prod.output).toBe('standalone');
  });

  // #134: response headers.
  it('does not announce Next.js', () => {
    expect(prod.poweredByHeader).toBe(false);
    expect(dev.poweredByHeader).toBe(false);
  });

  it('enforces exactly the framing, base, form and object rules', async () => {
    const csp = directives((await headersOf(prod)).get('Content-Security-Policy')!);
    expect([...csp.keys()].sort()).toEqual(['base-uri', 'form-action', 'frame-ancestors', 'object-src']);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    // Before JS loads, the Google button is a form POST redirected to Google.
    expect(csp.get('form-action')).toEqual(["'self'", 'https://accounts.google.com']);
  });

  it('reports the full policy, Turnstile and Google Fonts allowed', async () => {
    const csp = directives((await headersOf(prod)).get('Content-Security-Policy-Report-Only')!);
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('script-src')).toEqual(["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com']);
    expect(csp.get('style-src')).toEqual(["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']);
    expect(csp.get('font-src')).toEqual(["'self'", 'https://fonts.gstatic.com']);
    expect(csp.get('img-src')).toEqual(["'self'", 'data:']);
    expect(csp.get('connect-src')).toEqual(["'self'", 'https://challenges.cloudflare.com']);
    expect(csp.get('frame-src')).toEqual(['https://challenges.cloudflare.com']);
    for (const d of ['frame-ancestors', 'base-uri', 'form-action', 'object-src']) expect(csp.has(d)).toBe(true);
  });

  it("allows 'unsafe-eval' only on the dev server", async () => {
    const devCsp = directives((await headersOf(dev)).get('Content-Security-Policy-Report-Only')!);
    expect(devCsp.get('script-src')).toContain("'unsafe-eval'");
    expect((await headersOf(prod)).get('Content-Security-Policy-Report-Only')).not.toContain('unsafe-eval');
  });

  it('sends the other hardening headers', async () => {
    const h = await headersOf(prod);
    expect(h.get('X-Frame-Options')).toBe('DENY');
    expect(h.get('X-Content-Type-Options')).toBe('nosniff');
    expect(h.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(h.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  });

  // Browsers ignore HSTS over plain HTTP, so dev on localhost is unaffected;
  // no includeSubDomains, so other hosts on the family domain are left alone.
  it('sends HSTS for a year, this host only', async () => {
    expect((await headersOf(prod)).get('Strict-Transport-Security')).toBe('max-age=31536000');
  });
});
