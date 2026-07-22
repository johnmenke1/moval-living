import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { BusinessCard } from '@/components/business/BusinessCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tag } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Deals & Coupons',
  description: 'Save money at local Moreno Valley businesses with exclusive deals and coupons',
}

interface DealsPageProps {
  searchParams: Promise<{ sort?: string; page?: string }>
}

async function getDeals(params: { sort?: string; page?: string }) {
  const page = parseInt(params.page || '1')
  const skip = (page - 1) * 20

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderBy: any = params.sort === 'name'
    ? { name: 'asc' }
    : params.sort === 'rating'
    ? { reviews: { _count: 'desc' } }
    : { createdAt: 'desc' }

  const [businesses, total] = await Promise.all([
    prisma.business.findMany({
      where: { status: 'APPROVED', hasCoupon: true },
      include: {
        category: true,
        reviews: true,
        _count: { select: { reviews: true } },
      },
      orderBy,
      skip,
      take: 20,
    }),
    prisma.business.count({ where: { status: 'APPROVED', hasCoupon: true } }),
  ])

  return {
    businesses: businesses.map(b => ({
      ...b,
      coupon: b.coupon as {
        headline: string
        description?: string | null
        code?: string | null
        expiresAt?: string | null
      } | null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / 20),
  }
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const params = await searchParams
  const { businesses, total, page, totalPages } = await getDeals(params)

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
          <p className="text-text-secondary text-lg">
            Save money at local Moreno Valley businesses with exclusive offers.
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
              { value: 'rating', label: 'Top Rated' },
              { value: 'name', label: 'A–Z' },
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

        {businesses.length === 0 ? (
          <EmptyState
            title="No deals yet"
            description="Be the first business to add a deal! Listings with special offers get more clicks and inquiries."
            ctaLabel="Add a Deal"
            ctaHref="/submit"
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {businesses.map(business => (
                <BusinessCard key={business.id} business={business} />
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
