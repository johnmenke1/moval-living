'use client'

import dynamic from 'next/dynamic'

const ListingMapAsync = dynamic(
  () => import('./ListingMap').then((m) => m.ListingMap),
  {
    ssr: false,
    loading: () => <div className="w-full h-72 bg-slate-100 animate-pulse rounded-xl" />,
  },
)

interface ListingMapWrapperProps {
  lat: number
  lng: number
  address: string
}

/**
 * See BusinessMapWrapper for the API-key handling rationale: we read
 * `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` directly in the
 * 'use client' child rather than accepting it as a prop, to avoid
 * serializing it into the HTML payload.
 */
export function ListingMapWrapper(props: ListingMapWrapperProps) {
  return <ListingMapAsync {...props} />
}
