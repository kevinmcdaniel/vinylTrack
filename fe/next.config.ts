import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production image (#60) ships .next/standalone: server.js plus only the
  // node_modules it actually imports. `next dev` ignores this.
  output: "standalone",
};

export default nextConfig;
