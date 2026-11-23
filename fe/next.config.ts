import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production image (#60) ships .next/standalone: server.js plus only the
  // node_modules it actually imports. `next dev` ignores this.
  output: "standalone",
  // Nothing uses next/image, and /_next/image is reachable without a session
  // (proxy.ts skips it), so the optimizer is off rather than exposed (#129).
  images: { unoptimized: true },
  // #9: a cached service worker would pin a phone to an old release, so the
  // browser always fetches /sw.js fresh. The worker itself lands in task 1.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
