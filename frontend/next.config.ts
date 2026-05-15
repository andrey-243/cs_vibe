import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn-api.pandascore.co" },
      { protocol: "https", hostname: "*.pandascore.co" },
    ],
  },
};

export default nextConfig;
