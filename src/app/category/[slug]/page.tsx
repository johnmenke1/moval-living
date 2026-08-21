import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCategoryBySlug } from '@/data/categories'
import { getCategoryContent } from '@/data/category-content'
import { compareBusinessesForSearch } from '@/lib/business-priority'
import { BusinessCard } from '@/components/business/BusinessCard'
import { FaqSection } from '@/components/seo/FaqSection'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildItemList } from '@/lib/seo-schema'
import { RelatedCategories } from './RelatedCategories'

/**
 * Live DB freshness: force-dynamic matches the pattern on /best-of, /events,
 * /insights, and /parks so admin changes (new approvals, tier moves,
 * archive) appear on the page immediately. Without this, Next.js would
 * prerender at build time and Vercel would serve the snapshot from its
 * edge cache (X-Nextjs-Stale-Time: 300) until the next deploy.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

const BASE = 'https://www.moval.living'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) {
    return { title: 'Category Not Found' }
  }
  const content = getCategoryContent(slug)
  const description = content?.metaDescription
    ?? `Browse approved ${category.name.toLowerCase()} businesses in Moreno Valley, CA. Photos, hours, reviews, and contact info.`

  return {
    title: `${category.name} in Moreno Valley, CA | moval.living`,
    description,
    alternates: { canonical: `${BASE}/category/${category.slug}` },
    openGraph: {
      type: 'website',
      url: `${BASE}/category/${category.slug}`,
      title: `${category.name} in Moreno Valley, CA`,
      description,
      images: [{ url: category.image, width: 800, height: 533, alt: category.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category.name} in Moreno Valley, CA`,
      description,
      images: [category.image],
    },
  }
}

async function getCategoryBusinesses(slug: string) {
  // We do the category-row check at the page level via getCategoryBySlug
  // so unknown slugs 404 cleanly. Here we just query.
  return prisma.business.findMany({
    where: {
      status: 'APPROVED',
      category: { slug },
    },
    include: {
      category: { select: { name: true, slug: true } },
      reviews: { select: { rating: true } },
      _count: { select: { reviews: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) notFound()

  const content = getCategoryContent(slug)
  const businesses = await getCategoryBusinesses(slug)
  businesses.sort(compareBusinessesForSearch)

  // ── JSON-LD: ItemList of the businesses on this page ──────────────────
  const itemList = buildItemList(
    `${category.name} in Moreno Valley, CA`,
    businesses.map((b, idx) => ({
      position: idx + 1,
      name: b.name,
      url: `${BASE}/business/${b.slug}`,
      image: b.logo ?? b.coverImage ?? undefined,
      description: b.tagline ?? undefined,
    })),
  )

  // ── JSON-LD: BreadcrumbList (Home › Categories › <name>) ──────────────
  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: 'Categories', item: `${BASE}/search` },
      { '@type': 'ListItem', position: 3, name: category.name, item: `${BASE}/category/${category.slug}` },
    ],
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero band — category image, name, intro, live count */}
      <section className="relative bg-secondary text-white overflow-hidden">
        <img
          src={category.image}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/80 to-secondary/60" />
        <div className="relative container-max py-12 sm:py-16">
          <Link
            href="/search"
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to all categories
          </Link>
          <div className="flex items-center gap-2 text-white/70 text-xs font-bold uppercase tracking-[0.16em] mb-3">
            <Building2 className="w-4 h-4" /> Category
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.05] mb-4 max-w-3xl">
            {category.name} in Moreno Valley, CA
          </h1>
          <p className="text-white/85 text-base sm:text-lg max-w-3xl leading-relaxed">
            {content?.intro ?? category.description}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-sm font-semibold">
            <Building2 className="w-4 h-4" />
            {businesses.length} approved {businesses.length === 1 ? 'business' : 'businesses'}
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="container-max py-10">
        {businesses.length === 0 ? (
          <EmptyCategoryState categoryName={category.name} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {businesses.map(business => (
              <BusinessCard
                key={business.id}
                business={business as React.ComponentProps<typeof BusinessCard>['business']}
              />
            ))}
          </div>
        )}

        {/* FAQ block — server-rendered JSON-LD via FaqSection (AEO-safe) */}
        {content && content.faqs.length > 0 && (
          <div className="mt-12">
            <FaqSection
              title={`${category.name} FAQs`}
              subtitle={`Common questions about ${category.name.toLowerCase()} in Moreno Valley.`}
              faqs={content.faqs}
            />
          </div>
        )}

        {/* Related categories — internal-link juice for the cluster */}
        <RelatedCategories currentSlug={category.slug} />
      </div>

      {/* Inline JSON-LD — server-rendered, in initial HTML for AI crawlers */}
      <JsonLd schema={itemList} />
      <JsonLd schema={breadcrumbList} />
    </div>
  )
}

function EmptyCategoryState({ categoryName }: { categoryName: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto mb-5">
        <Building2 className="w-7 h-7" />
      </div>
      <h2 className="text-2xl font-bold text-text mb-2">
        No {categoryName.toLowerCase()} listed yet
      </h2>
      <p className="text-text-secondary max-w-lg mx-auto mb-6 leading-relaxed">
        Be the first. We review every submission personally and
        publish within 1–2 business days.
      </p>
      <Link
        href="/submit"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" /> Submit a business
      </Link>
    </div>
  )
}
