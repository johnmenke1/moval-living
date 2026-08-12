'use client'

import dynamic from 'next/dynamic'
import type { OpenHouseListing } from '@/app/api/trestle/open-houses/route'

const OpenHouseMapAsync = dynamic(
  () => import('./OpenHouseMap').then((m) => m.OpenHouseMap),
  {
    ssr: false,
    loading: () => <div className="w-full h-[400px] bg-slate-100 animate-pulse rounded-xl" />,
  }
)

interface OpenHouseMapWrapperProps {
  listings: OpenHouseListing[]
  highlightedKey?: string | null
}

/**
 * See BusinessMapWrapper for the API-key handling rationale: we read
 * `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` directly in the
 * 'use client' child rather than accepting it as a prop, to avoid
 * serializing it into the HTML payload.
 */
export function OpenHouseMapWrapper(props: OpenHouseMapWrapperProps) {
  return <OpenHouseMapAsync {...props} />
}
