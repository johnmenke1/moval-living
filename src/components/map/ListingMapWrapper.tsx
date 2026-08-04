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
  apiKey?: string
}

export function ListingMapWrapper(props: ListingMapWrapperProps) {
  return <ListingMapAsync {...props} />
}
