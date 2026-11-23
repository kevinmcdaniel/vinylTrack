import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Response headers (#134). They live here, not in Cloudflare rules: in the
// repo, tested (next.config.test.ts), and the same locally as in production.
// To widen a directive, add the source to POLICY and the test's expectation.
const TURNSTILE = "https://challenges.cloudflare.com";

const POLICY: Record<string, string[]> = {
  "default-src": ["'self'"],
  // 'unsafe-inline' for Next's bootstrap and streaming scripts; a nonce would
  // need proxy.ts on /sign-in, which it deliberately skips (#94). Follow-up.
  "script-src": ["'self'", "'unsafe-inline'", TURNSTILE],
  // The root layout's theme <style> and React's injected styles.
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  "img-src": ["'self'", "data:"],
  "connect-src": ["'self'", TURNSTILE],
  "frame-src": [TURNSTILE],
};

// Enforced now: the protection that matters (clickjacking every write form)
// at little risk. Before JS loads the Google button is a form POST redirected
// to Google, and Chrome holds form-action to redirect targets too.
const ENFORCED: Record<string, string[]> = {
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'", "https://accounts.google.com"],
  "object-src": ["'none'"],
};

const serialize = (policy: Record<string, string[]>) =>
  Object.entries(policy).map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");

export default function nextConfig(phase: string): NextConfig {
  // React's dev error overlay needs eval; production never does.
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  const full = { ...POLICY, "script-src": [...POLICY["script-src"]!, ...(dev ? ["'unsafe-eval'"] : [])], ...ENFORCED };
  return {
    // Production image (#60) ships .next/standalone: server.js plus only the
    // node_modules it actually imports. `next dev` ignores this.
    output: "standalone",
    // Nothing uses next/image, and /_next/image is reachable without a session
    // (proxy.ts skips it), so the optimizer is off rather than exposed (#129).
    images: { unoptimized: true },
    poweredByHeader: false,
    async headers() {
      return [{
        // #9: a cached service worker would pin a phone to an old release, so
        // the browser always fetches /sw.js fresh. The worker lands in task 1.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      }, {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: serialize(ENFORCED) },
          // Report-only for one release: Cloudflare can inject scripts in
          // production that no local check sees. Enforce once prod is clean.
          { key: "Content-Security-Policy-Report-Only", value: serialize(full) },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          // Fixed at build, so sent everywhere: browsers ignore HSTS over plain
          // HTTP (RFC 6797 §8.1). No includeSubDomains: other family hosts stay free.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      }];
    },
  };
}
