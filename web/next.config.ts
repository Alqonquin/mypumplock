import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // WHY: pg uses native TCP sockets and @prisma/adapter-pg wraps it.
  // Webpack bundling breaks these — they must run as normal Node modules.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;
