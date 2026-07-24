import { Suspense } from 'react'
import ClaimPageClient from './ClaimPageClient'

export const dynamic = 'force-dynamic'

export default function ClaimPage() {
  return (
    <Suspense fallback={<div className="bg-slate-50 min-h-screen flex items-center justify-center"><p className="text-text-secondary">Loading...</p></div>}>
      <ClaimPageClient />
    </Suspense>
  )
}
