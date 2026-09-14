import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ChevronLeft, UserCheck } from 'lucide-react'
import ClaimedBusinessesClient from '@/components/admin/ClaimedBusinessesClient'

// /dashboard/claimed — admin-focused roster of all claimed businesses.
// Distinct from /dashboard (BusinessesModeration tab) which mixes all
// statuses and pulls dozens of unrelated fields. This view is opinionated:
// just claimed businesses, with owner identity front-and-center so admins
// can answer "who runs this listing?" at a glance.

export const dynamic = 'force-dynamic'

export default async function ClaimedBusinessesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard/claimed')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  // claimedAt is the lifecycle timestamp set the first time ownerId got
  // populated, so filtering on `claimedAt: { not: null }` is the canonical
  // "this business has been claimed" predicate. We exclude soft-claimed
  // rows where the token exists but ownerId is still null (those are
  // pending invites, not claimed listings).
  const claimedBusinesses = await prisma.business.findMany({
    where: {
      claimedAt: { not: null },
      ownerId: { not: null },
    },
    orderBy: { claimedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      tier: true,
      status: true,
      city: true,
      state: true,
      address: true,
      claimedAt: true,
      featuredAt: true,
      isExpertPartner: true,
      category: { select: { name: true, slug: true } },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          emailOptIn: true,
        },
      },
      _count: { select: { reviews: true, deals: true } },
    },
  })

  // Counts panel — claim activity is the headline number for this view.
  const [totalApproved, totalFeatured, totalEverClaimed] = await Promise.all([
    prisma.business.count({ where: { claimedAt: { not: null }, status: 'APPROVED' } }),
    prisma.business.count({ where: { claimedAt: { not: null }, tier: { in: ['FEATURED', 'EXPERT_PARTNER'] } } }),
    prisma.business.count({ where: { claimedAt: { not: null } } }),
  ])

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-6 sm:py-8 flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary w-fit"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#e0f5f5] text-[#007a7f] mb-2">
                <UserCheck className="w-3.5 h-3.5" />
                Claimed Businesses
              </div>
              <h1 className="text-3xl font-bold text-text mb-1">Who&apos;s claimed their listing</h1>
              <p className="text-text-secondary">
                Every business with an active owner. Sorted by most recently claimed.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-max py-6">
        <ClaimedBusinessesClient
          businesses={claimedBusinesses.map(b => ({
            ...b,
            claimedAt: b.claimedAt!.toISOString(),
            featuredAt: b.featuredAt ? b.featuredAt.toISOString() : null,
            owner: {
              ...b.owner!,
              // owner is non-null because the where clause filters it out;
              // the cast keeps TS happy without a separate nullable branch.
            },
          }))}
          counts={{
            total: claimedBusinesses.length,
            approved: totalApproved,
            featuredOrPartner: totalFeatured,
            everClaimed: totalEverClaimed,
          }}
        />
      </div>
    </div>
  )
}
