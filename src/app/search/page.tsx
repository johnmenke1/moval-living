import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { categories } from '@/data/categories'
import { BusinessCard } from '@/components/business/BusinessCard'
import { SearchFilters } from '@/components/search/SearchFilters'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Metadata } from 'next'

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    tier?: string
    sort?: string
    page?: string
  }>
}

export const metadata: Metadata = {
  title: 'Browse Businesses',
  description: 'Search and discover local businesses in Moreno Valley, CA',
}

const RESULTS_PER_PAGE = 20

async function getBusinesses(params: {
  q?: string
  category?: string
  tier?: string
  sort?: string
  page?: string
}) {
  const page = parseInt(params.page || '1')
  const skip = (page - 1) * RESULTS_PER_PAGE

  const where: Record<string, unknown> = {
    status: 'APPROVED',
  }

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: 'insensitive' } },
      { description: { contains: params.q, mode: 'insensitive' } },
      { tagline: { contains: params.q, mode: 'insensitive' } },
    ]
  }

  if (params.category) {
    where.category = { slug: params.category }
  }

  if (params.tier) {
    where.tier = params.tier.toUpperCase()
  }

  let orderBy: Record<string, unknown> = { createdAt: 'desc' }
  if (params.sort === 'rating') {
    orderBy = { reviews: { _count: 'desc' } } as Record<string, unknown>
  } else if (params.sort === 'name') {
    orderBy = { name: 'asc' }
  }

  const [businesses, total] = await Promise.all([
    prisma.business.findMany({
      where,
      include: {
        category: true,
        reviews: true,
        _count: { select: { reviews: true } },
      },
      orderBy,
      skip,
      take: RESULTS_PER_PAGE,
    }),
    prisma.business.count({ where }),
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
    totalPages: Math.ceil(total / RESULTS_PER_PAGE),
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const { businesses, total, page, totalPages } = await getBusinesses(params)
  const selectedCategory = categories.find(c => c.slug === params.category)

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Search Header */}
      <div className="bg-white border-b border-slate-100 sticky top-16 z-30">
        <div className="container-max py-6">
          <SearchFilters
            categories={categories}
            currentParams={params}
            resultCount={total}
          />
        </div>
      </div>

      <div className="container-max py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text">
              {params.q
                ? `Results for "${params.q}"`
                : selectedCategory
                ? selectedCategory.name
                : 'All Businesses'}
            </h1>
            <p className="text-text-secondary text-sm mt-0.5">
              {total} business{total !== 1 ? 'es' : ''} found in Moreno Valley
            </p>
          </div>
        </div>

        {businesses.length === 0 ? (
          <EmptyState
            title="No businesses found"
            description={
              params.q
                ? `We couldn't find anything matching "${params.q}". Try a different search or browse by category.`
                : 'No businesses in this category yet. Be the first to list!'
            }
            ctaLabel="Submit a Business"
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
                    href={`/search?${buildQueryString({ ...params, page: String(page - 1) })}`}
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
                    href={`/search?${buildQueryString({ ...params, page: String(page + 1) })}`}
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

function buildQueryString(params: Record<string, string | undefined>): string {
  return new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as string[][]
  ).toString()
}
