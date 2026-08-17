import type { NextConfig } from 'next'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd())

const nextConfig: NextConfig = {
  // Workaround for https://github.com/vercel/next.js/issues/95545
  // (InvariantError: Expected workStore to be initialized during static
  // prerender of /_global-error on Windows + Turbopack / multi-core builds).
  // Re-running the prerender for affected routes absorbs the race.
  experimental: {
    staticGenerationRetryCount: 3,
  },
  // Pin Turbopack's workspace root to the absolute, cased repo path so it
  // doesn't try to look for next/package.json from a sibling lowercase
  // clone (`C:\Users\john\projects\...`) on Windows. Without this,
  // Turbopack infers the wrong root and the build fails with
  // "couldn't find the Next.js package" when the working directory has
  // an uppercase-only canonical form on disk but the build is launched
  // through a different case-sensitive path.
  turbopack: {
    root: repoRoot,
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
