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
  apiKey?: string
}

export function BusinessMapWrapper(props: BusinessMapWrapperProps) {
  return <BusinessMapAsync {...props} />
}
