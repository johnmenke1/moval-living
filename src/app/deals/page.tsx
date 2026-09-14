import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { DealCardPublic, DealPublicBusiness } from '@/components/business/DealCardPublic'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tag } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Deals & Coupons',
  description: 'Save money at local Moreno Valley businesses with exclusive deals and coupons',
  alternates: { canonical: 'https://www.moval.living/deals' },
}

interface DealsPageProps {
  searchParams: Promise<{ sort?: string; page?: string }>
}

// Refactored 2026-09-14 to render ONE card per Deal row. Previously
// this page listed one card per business (using BusinessCard), which
// made it impossible for a business to surface more than one active
// offer. Now the page queries Deal directly; the migration
// 20260914000000_add_deal_model backfilled one Deal row per legacy
// Business.coupon Json so nothing was lost in the switch.
async function getDeals(params: { sort?: string; page?: string }) {
  const page = Math.max(1, parseInt(params.page || '1'))
  const skip = (page - 1) * 20

  const now = new Date()
  const where = {
    isActive: true,
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
    AND: [
      {
        OR: [
          { startsAt: null },
          { startsAt: { lte: now } },
        ],
      },
      { business: { status: 'APPROVED' as const } },
    ],
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderBy: any = params.sort === 'expiring'
    ? [{ isActive: 'desc' }, { expiresAt: 'asc' }]
    : params.sort === 'business'
      ? [{ business: { name: 'asc' as const } }, { createdAt: 'desc' as const }]
      : [{ displayOrder: 'asc' as const }, { createdAt: 'desc' as const }]

  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      include: {
        business: {
          select: {
            id: true,
            slug: true,
            name: true,
            tagline: true,
            logo: true,
            coverImage: true,
            category: { select: { name: true, slug: true } },
            _count: { select: { reviews: true } },
          },
        },
      },
      orderBy,
      skip,
      take: 20,
    }),
    prisma.deal.count({ where }),
  ])

  return {
    deals: deals.map(d => {
      // Cast through `unknown` so TypeScript keeps the `include`
      // shape (notably `business`) while we re-shape the Date fields
      // to ISO strings. The included relations survive the spread;
      // only the top-level Date columns are coerced.
      const r = d as unknown as {
        id: string
        businessId: string
        headline: string
        description: string | null
        code: string | null
        imageUrl: string | null
        startsAt: Date | null
        expiresAt: Date | null
        displayOrder: number
        isActive: boolean
        createdAt: Date
        updatedAt: Date
        business: DealPublicBusiness
      }
      return {
        ...r,
        startsAt: r.startsAt ? r.startsAt.toISOString() : null,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }
    }),
    total,
    page,
    totalPages: Math.ceil(total / 20),
  }
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const params = await searchParams
  const { deals, total, page, totalPages } = await getDeals(params)

  // Pick a "featured right now" deal for the answer capsule — the most
  // recently created deal on the first page. Used the same way the
  // legacy page used businesses[0] (it picked the newest business).
  const featured = deals[0]

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Tag className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-3xl font-bold text-text">Deals & Coupons</h1>
          </div>

          {/* Answer capsule — server-rendered, first ~150 words of HTML.
              AI engines lift this when answering queries like "what deals
              are available in Moreno Valley today?" Updated 2026-09-14
              to reference a specific deal (not a business) since one
              business may now have multiple deals. */}
          <p className="text-text text-lg max-w-3xl leading-relaxed">
            There {total === 1 ? 'is 1 active deal' : `are ${total} active deals`}
            {' '}from Moreno Valley businesses — exclusive offers from local
            restaurants, salons, service providers, and retailers.
            {featured && (
              <> Featured right now: <strong>{featured.headline}</strong>
                {' from '}<strong>{featured.business.name}</strong>.</>
            )}
            {total === 0 && (
              <> No deals listed yet — local businesses can add theirs through the dashboard.</>
            )}
          </p>
        </div>
      </div>

      <div className="container-max py-8">
        {/* Sort bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-text-secondary text-sm">
            {total} deal{total !== 1 ? 's' : ''} available
          </p>
          <div className="flex items-center gap-1">
            <span className="text-sm text-text-secondary mr-1">Sort:</span>
            {[
              { value: 'newest', label: 'Newest' },
              { value: 'expiring', label: 'Expiring Soon' },
              { value: 'business', label: 'By Business' },
            ].map(option => {
              const isActive = (params.sort || 'newest') === option.value
              const href = `/deals?${buildQuery({ ...params, sort: option.value, page: undefined })}`
              return (
                <a
                  key={option.value}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:bg-slate-100'
                  }`}
                >
                  {option.label}
                </a>
              )
            })}
          </div>
        </div>

        {deals.length === 0 ? (
          <EmptyState
            title="No deals yet"
            description="Be the first business to add a deal! Listings with special offers get more clicks and inquiries."
            ctaLabel="Add a Deal"
            ctaHref="/submit"
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {deals.map(deal => (
                <DealCardPublic key={deal.id} deal={deal as never} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                {page > 1 && (
                  <a
                    href={`/deals?${buildQuery({ ...params, page: String(page - 1) })}`}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-text hover:bg-slate-50 transition-colors"
                  >
                    ← Previous
                  </a>
                )}
                <span className="px-4 py-2 text-text-secondary">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <a
                    href={`/deals?${buildQuery({ ...params, page: String(page + 1) })}`}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-text hover:bg-slate-50 transition-colors"
                  >
                    Next →
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function buildQuery(params: Record<string, string | undefined>): string {
  return new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as string[][]
  ).toString()
}
