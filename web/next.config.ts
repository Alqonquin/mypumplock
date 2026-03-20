import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // WHY: pg uses native TCP sockets and @prisma/adapter-pg wraps it.
  // Webpack bundling breaks these — they must run as normal Node modules.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  // WHY: Amplify Hosting doesn't reliably support Next.js image optimization.
  // Serving images unoptimized ensures they load correctly on all platforms.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
