import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'movalliving.s3.us-west-1.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
