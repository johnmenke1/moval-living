import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Re-running the prerender for affected routes absorbs a Windows +
  // Next.js 16 race on /_global-error.
  // (Originally paired with a Turbopack workspace-root workaround that's
  // no longer needed since we run `next dev --webpack`.)
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
}

export default nextConfig
