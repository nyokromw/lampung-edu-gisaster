import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "konsentris.id" },
      { protocol: "https", hostname: "asset.kompas.com" },
      { protocol: "https", hostname: "awsimages.detik.net.id" },
      { protocol: "https", hostname: "encrypted-tbn0.gstatic.com" },
    ],
  },
};

export default nextConfig;