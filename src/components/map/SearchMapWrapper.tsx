'use client'

import dynamic from 'next/dynamic'
import type { SearchBusinessMapItem } from './SearchMap'

interface SearchMapWrapperProps {
  businesses: SearchBusinessMapItem[]
}

const SearchMapAsync = dynamic(
  () => import('./SearchMap').then((m) => m.SearchMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[420px] bg-slate-100 animate-pulse rounded-2xl border border-slate-200" />
    ),
  },
)

export function SearchMapWrapper({ businesses }: SearchMapWrapperProps) {
  return <SearchMapAsync businesses={businesses} />
}
