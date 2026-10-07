import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // CRITICAL: These packages MUST stay server-side only.
  // If they leak into client bundles, they cause 'M_ID' errors
  // and other runtime crashes in the browser.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-libsql",
    "prisma",
    "bcrypt",
    "bcryptjs",
    "@node-rs/bcrypt",
    "jsonwebtoken",
    "@vercel/blob",
  ],
  // Make sure static files are served as-is
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
