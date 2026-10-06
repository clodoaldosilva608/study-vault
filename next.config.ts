import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow Prisma to be bundled server-side. Some Prisma engines need this.
  serverExternalPackages: ["@prisma/client", "bcrypt"],
  // Increase the function timeout for the schema-push setup endpoint.
  experimental: {
    // Allow server functions to run longer for the prisma db push on cold starts.
  },
  // Make sure static files (manifest, sw.js, icons) are served as-is.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
