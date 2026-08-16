import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workaround for https://github.com/vercel/next.js/issues/95545
  // (InvariantError: Expected workStore to be initialized during static
  // prerender of /_global-error on Windows + Turbopack / multi-core builds).
  // Re-running the prerender for affected routes absorbs the race.
  experimental: {
    staticGenerationRetryCount: 3,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'movalliving.s3.us-west-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
};

export default nextConfig;
