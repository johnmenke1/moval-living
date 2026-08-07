import PricingPageClient from './PricingPageClient'
import { Suspense } from 'react'

export const metadata = {
  title: 'Pricing — moval.living',
  description:
    'Upgrade your moval.listing to Featured or become a Moreno Valley Expert Partner. Real local exposure, every month.',
}

// Page is dynamic — uses searchParams for category pre-select
export const dynamic = 'force-dynamic'

export default function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  return (
    <Suspense fallback={null}>
      <PricingSearchParamsBridge searchParams={searchParams} />
    </Suspense>
  )
}

async function PricingSearchParamsBridge({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const params = await searchParams
  return <PricingPageClient initialCategory={params.category} />
}