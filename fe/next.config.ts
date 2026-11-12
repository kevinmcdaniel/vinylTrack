import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production image (#60) ships .next/standalone: server.js plus only the
  // node_modules it actually imports. `next dev` ignores this.
  output: "standalone",
  // Nothing uses next/image, and /_next/image is reachable without a session
  // (proxy.ts skips it), so the optimizer is off rather than exposed (#129).
  images: { unoptimized: true },
};

export default nextConfig;
