'use client'

import dynamic from 'next/dynamic'

const BusinessMapAsync = dynamic(
  () => import('./BusinessMap').then((m) => m.BusinessMap),
  {
    ssr: false,
    loading: () => <div className="w-full h-72 bg-slate-100 animate-pulse rounded-xl" />,
  },
)

interface BusinessMapWrapperProps {
  address: string
  city: string
  state: string
  zip: string
  name?: string
}

/**
 * NOTE: We intentionally do NOT accept the API key as a prop. Passing it
 * as a prop from a server component causes Next.js to serialize it into
 * the HTML payload (visible via raw `curl`), even though it's also a
 * `NEXT_PUBLIC_` env var (visible in the client bundle). Reading it
 * directly via `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in this
 * 'use client' component keeps it in the bundle only — not the HTML.
 *
 * Mitigate further by HTTP-referer-restricting the key in Google Cloud
 * Console to your domain(s) only.
 */
export function BusinessMapWrapper(props: BusinessMapWrapperProps) {
  return <BusinessMapAsync {...props} />
}
