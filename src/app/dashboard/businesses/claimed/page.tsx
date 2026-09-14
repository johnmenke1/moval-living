import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ShieldCheck } from 'lucide-react'
import { auth } from '@/auth'
import { getClaimedBusinesses, getClaimedBusinessStats } from '@/lib/admin-claimed-businesses'
import ClaimedBusinessesList from '@/components/admin/ClaimedBusinessesList'

// Admin-only view of every business that has been claimed by an owner.
// Loaded at /dashboard/businesses/claimed. Read-only in v1 — write
// actions (resend claim email, unclaim, transfer) are deferred to a
// follow-up PR.
//
// Header shape mirrors /dashboard/deals and /dashboard/edit so admins
// stay oriented. Stats chip shows the total + last-30-day count so
// the admin can see recent claim activity at a glance.

export const dynamic = 'force-dynamic'

export default async function ClaimedBusinessesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const [businesses, stats] = await Promise.all([
    getClaimedBusinesses(),
    getClaimedBusinessStats(),
  ])

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary mb-3 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-text">Claimed Businesses</h1>
          </div>
          <p className="text-text-secondary">
            Every business with a verified owner. Read-only view &mdash;{' '}
            <strong className="text-text">{stats.total}</strong> claimed
            {stats.last30d > 0 && (
              <>
                {' '}&middot; <strong className="text-text">{stats.last30d}</strong> in the last 30 days
              </>
            )}
            {stats.last7d > 0 && (
              <>
                {' '}&middot; <strong className="text-text">{stats.last7d}</strong> this week
              </>
            )}
            .
          </p>
        </div>
      </div>

      <div className="container-max py-8">
        <ClaimedBusinessesList businesses={businesses} />
      </div>
    </div>
  )
}
