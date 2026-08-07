import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Sparkles, Check, Clock } from 'lucide-react'
import { ExpertPartnerBadge } from '@/components/business/ExpertPartnerBadge'

export const metadata: Metadata = {
  title: 'Moreno Valley Expert Partners — moval.living',
  description:
    'One business per category gets featured, interviewed, and promoted across moval.living, our social channels, and our newsletter every month.',
  alternates: { canonical: 'https://www.moval.living/partners' },
}

export const dynamic = 'force-dynamic'

async function getPartnersData() {
  const [partners, categories, allCategories] = await Promise.all([
    prisma.business.findMany({
      where: {
        isExpertPartner: true,
        status: 'APPROVED',
      },
      select: {
        id: true,
        slug: true,
        expertPartnerSlug: true,
        name: true,
        tagline: true,
        logo: true,
        coverImage: true,
        category: { select: { id: true, name: true, slug: true } },
        isExpertPartner: true,
        foundingPartnerSince: true,
      },
      orderBy: [{ foundingPartnerSince: 'asc' }, { name: 'asc' }],
    }),
    prisma.business.findMany({
      where: {
        isExpertPartner: true,
        status: 'APPROVED',
      },
      select: { categoryId: true },
    }),
    prisma.category.findMany({
      select: { id: true, name: true, slug: true, icon: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const claimedCategoryIds = new Set(partners.map((p) => p.category.id))
  return { partners, allCategories, claimedCategoryIds }
}

export default async function PartnersPage() {
  const { partners, allCategories, claimedCategoryIds } = await getPartnersData()

  return (
    <div className="bg-[#f0efeb] min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#007a7f] to-[#00405c] text-white py-20">
        <div className="container-max text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            <Sparkles className="w-4 h-4" />
            Limited partnerships — one business per category
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Moreno Valley Expert Partners
          </h1>
          <p className="text-white/85 text-lg max-w-2xl mx-auto">
            Real local exposure, every month. One business per category gets featured,
            interviewed, and promoted across moval.living, our social channels, and our
            newsletter — a true ongoing local PR engine, not a directory ad.
          </p>
        </div>
      </section>

      {/* Open Categories + Active Partners */}
      <section className="container-max py-16">
        <div className="grid lg:grid-cols-2 gap-10 max-w-6xl mx-auto">
          {/* Available Categories */}
          <div>
            <h2 className="text-2xl font-bold text-[#1a2e35] mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-[#007a7f]" />
              See Open Categories
            </h2>
            <p className="text-[#5a6c72] mb-6 text-sm">
              These categories are still available. Claim yours before a competitor does.
            </p>
            <div className="space-y-2">
              {allCategories.length === 0 && (
                <p className="text-sm text-[#5a6c72]">No categories yet.</p>
              )}
              {allCategories.map((cat) => {
                const claimed = claimedCategoryIds.has(cat.id)
                return (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      claimed
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-white border-[#007a7f]/30 hover:border-[#007a7f]'
                    }`}
                  >
                    <span
                      className={`font-medium ${
                        claimed ? 'text-slate-400 line-through' : 'text-[#1a2e35]'
                      }`}
                    >
                      {cat.name}
                    </span>
                    {claimed ? (
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        Claimed
                      </span>
                    ) : (
                      <Link
                        href={`/pricing?category=${cat.slug}`}
                        className="text-xs font-bold text-[#007a7f] hover:underline uppercase tracking-wide"
                      >
                        Available →
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Active Partners */}
          <div>
            <h2 className="text-2xl font-bold text-[#1a2e35] mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              Our Expert Partners
            </h2>
            <p className="text-[#5a6c72] mb-6 text-sm">
              Businesses who&apos;ve claimed their category slot and are getting featured monthly.
            </p>
            {partners.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                <p className="text-[#5a6c72]">
                  No Expert Partners yet. Be the first — your category could be the first claimed.
                </p>
                <Link
                  href="/pricing"
                  className="inline-block mt-4 px-6 py-2 bg-[#007a7f] text-white font-semibold rounded-lg hover:bg-[#006a70]"
                >
                  Become a Partner
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {partners.map((p) => (
                  <Link
                    key={p.id}
                    href={`/partners/${p.expertPartnerSlug || p.slug}`}
                    className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-[#007a7f] hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-4">
                      {p.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.logo}
                          alt={`${p.name} logo`}
                          className="w-14 h-14 rounded-lg object-contain border border-slate-100 bg-white"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-[#007a7f]/10 to-[#00405c]/10 flex items-center justify-center">
                          <span className="text-xl font-bold text-[#007a7f]/40">
                            {p.name[0]}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-[#1a2e35] truncate">{p.name}</h3>
                            <p className="text-xs text-[#5a6c72] mt-0.5">
                              {p.category.name}
                            </p>
                          </div>
                          <ExpertPartnerBadge
                            business={{
                              isExpertPartner: p.isExpertPartner,
                              foundingPartnerSince: p.foundingPartnerSince,
                            }}
                            variant="inline"
                          />
                        </div>
                        {p.tagline && (
                          <p className="text-sm text-[#5a6c72] mt-2 line-clamp-2">
                            {p.tagline}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* What You Get — condensed from main pitch */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="container-max max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1a2e35] text-center mb-10">
            What Expert Partners Get
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Category Exclusivity',
                body: 'You\'re the only business in your category with this placement. Once claimed, off the market.',
              },
              {
                title: 'Monthly Featured Story',
                body: 'A real interview-based feature story published on moval.living, optimized for local + AI-search.',
              },
              {
                title: 'Featured Listing Included',
                body: 'Premium placement across category and search pages — a $29/mo value, bundled in.',
              },
              {
                title: 'Social Promotion',
                body: 'Every feature story shared across moval.living social accounts — likes, shares, dedicated intro post.',
              },
              {
                title: 'Newsletter Placement',
                body: 'Your story goes to our weekly newsletter subscribers the week it publishes.',
              },
              {
                title: 'Monthly Performance Recap',
                body: 'A one-page summary of story views, newsletter opens, and listing clicks — see exactly what your placement is doing.',
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className="bg-[#f0efeb] border border-slate-200 rounded-xl p-6"
              >
                <div className="flex items-start gap-2 mb-2">
                  <Check className="w-5 h-5 text-[#007a7f] flex-shrink-0 mt-0.5" />
                  <h3 className="font-bold text-[#1a2e35]">{feat.title}</h3>
                </div>
                <p className="text-sm text-[#5a6c72] pl-7">{feat.body}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/pricing"
              className="inline-block px-8 py-3 bg-[#007a7f] text-white font-semibold rounded-lg hover:bg-[#006a70] text-lg"
            >
              See Pricing &amp; Claim Your Category →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}