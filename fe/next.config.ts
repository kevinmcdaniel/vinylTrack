import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production image (#60) ships .next/standalone: server.js plus only the
  // node_modules it actually imports. `next dev` ignores this.
  output: "standalone",
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
