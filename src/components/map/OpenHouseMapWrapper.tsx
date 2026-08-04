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
  apiKey?: string
}

export function OpenHouseMapWrapper(props: OpenHouseMapWrapperProps) {
  return <OpenHouseMapAsync {...props} />
}
