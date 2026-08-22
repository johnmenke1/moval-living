import { prisma } from '@/lib/prisma'
import { HomePageClient } from '@/components/home/HomePageClient'
import { JsonLd } from '@/components/seo/JsonLd'
import { compareBusinesses } from '@/lib/business-priority'
import type { Metadata } from 'next'

// Force dynamic rendering so featured businesses list is always fresh
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  alternates: { canonical: 'https://www.moval.living' },
}

const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MoVal Living',  // display name (canonical: Title Case)
  url: 'https://www.moval.living',  // URL stays lowercase
  description: 'Discover trusted local businesses in Moreno Valley, CA.',
  publisher: {
    '@type': 'Organization',
    name: 'MoVal Living',
    url: 'https://www.moval.living',
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://www.moval.living/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

// Top-level Organization entity for the homepage. This is the canonical
// "moval.living" entity that Google and AI engines consolidate against
// — every field here helps them resolve us as a single trusted local
// source (the foundation of GEO: engines cite entities they can resolve).
//
// Sources verified 2026-08-21:
//  - address: src/components/layout/Footer.tsx:60-61
//  - social: src/components/layout/Footer.tsx:76, 85, 94, 103
//  - email: src/components/layout/Footer.tsx:66-67
//  - logo: /public/logo.png (same path the Article schema uses)
const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://www.moval.living/#organization',
  name: 'MoVal Living',  // display name (canonical: Title Case)
  alternateName: 'MoVal Living',
  url: 'https://www.moval.living',  // URL stays lowercase
  description: 'Your trusted guide to local businesses in Moreno Valley, California.',
  logo: {
    '@type': 'ImageObject',
    url: 'https://www.moval.living/logo.png',
  },
  image: 'https://www.moval.living/logo.png',
  // sameAs consolidates us across platforms — Google checks both ways
  // (the entity says "I am also this profile") so these URLs must match
  // the footer's href attributes exactly.
  sameAs: [
    'https://www.instagram.com/moval_living/',
    'https://www.facebook.com/moval.living/',
    'https://www.linkedin.com/company/moval-living',
    'https://www.tiktok.com/@moval.living',
  ],
  // contactPoint is the modern Schema.org shape (top-level `email` was
  // deprecated in 2014). listing both English and Spanish matches the
  // site's Se habla español support and the IE demographic.
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'hello@moval.living',
      availableLanguage: ['English', 'Spanish'],
    },
  ],
  address: {
    '@type': 'PostalAddress',
    streetAddress: '23110 Atlantic Circle, Suite F',
    addressLocality: 'Moreno Valley',
    addressRegion: 'CA',
    postalCode: '92553',
    addressCountry: 'US',
  },
  areaServed: {
    '@type': 'City',
    name: 'Moreno Valley',
    addressRegion: 'CA',
    addressCountry: 'US',
  },
  // We don't list founder / foundingDate in the schema — those facts
  // aren't publicly stated anywhere on the site (the LLC paperwork
  // isn't signed yet), and Schema.org fields that don't match visible
  // site content get flagged by E-E-A-T checks as misleading. Add them
  // back when the legal entity is signed and an /about page states
  // them publicly.
}

async function getCategoryCounts() {
  // Single grouped query — count APPROVED businesses per category slug.
  const rows = await prisma.business.findMany({
    where: { status: 'APPROVED' },
    select: { category: { select: { slug: true } } },
  })
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const slug = r.category?.slug
    if (!slug) continue
    counts[slug] = (counts[slug] ?? 0) + 1
  }
  return counts
}

async function getHomepageBusinesses() {
  // Homepage is curated, not algorithmic: only Best-Of winners and Featured/Expert
  // Partner listings. Expert Partner is "Featured + more" — same elevated tier for
  // homepage placement. Order: BestOf+Featured/EP → Featured/EP only → BestOf-only.
  // No FREE listings.
  return prisma.business.findMany({
    where: {
      status: 'APPROVED',
      OR: [
        { tier: 'FEATURED' },
        { tier: 'EXPERT_PARTNER' },
        { isBestOfWinner: true },
      ],
    },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      address: true,
      tier: true,
      status: true,
      logo: true,
      coverImage: true,
      photos: true,
      createdAt: true,
      isBestOfWinner: true,
      isExpertPartner: true,
      foundingPartnerSince: true,
      // Languages & Chamber affiliation badges
      seHablaEspanol: true,
      chamberMember: true,
      hispanicChamberMember: true,
      category: { select: { name: true, slug: true } },
      reviews: { select: { rating: true } },
      _count: { select: { reviews: true } },
    },
  })
}

// Recent "Life in MoVal" editorial posts for the homepage callout. We pull the
// most recent published LIFE posts (capped at 3) and only the fields the
// homepage card actually renders — slug, title, excerpt, hero, publish date.
// If there are no published LIFE posts yet, the homepage falls back to hiding
// the section entirely (handled in HomePageClient).
async function getLatestLifePosts() {
  return prisma.guestPost.findMany({
    where: { status: 'published', postType: 'LIFE' },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImageUrl: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  })
}

// Upcoming curated events for the homepage call-out strip. We surface HERO
// + HONORABLE_MENTION tier events so the homepage reads as a curated pick
// rather than a calendar dump. Window is today + 30 days — wide enough to
// catch regional venue events (RMA, Fox) that are booked 2–3 weeks out,
// narrow enough that "this month" framing stays honest. Ordered by tier
// (HERO first) then start time so the marquee event leads the strip.
//
// Includes the linked business slug so event cards can link through to
// /business/[slug] when the event is hosted by a known MoVal business
// (matches the events-page HeroSection cardHref pattern).
async function getUpcomingEvents() {
  const now = new Date()
  const horizon = new Date(now.getTime() + 30 * 86400000)
  return prisma.event.findMany({
    where: {
      tier: { in: ['HERO', 'HONORABLE_MENTION'] },
      archivedAt: null,
      startsAt: { gte: now, lte: horizon },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      venueName: true,
      city: true,
      category: true,
      heroImageUrl: true,
      ticketUrl: true,
      isFree: true,
      esEnEspanol: true,
      tier: true,
      business: { select: { slug: true, name: true } },
    },
    orderBy: [{ tier: 'asc' }, { startsAt: 'asc' }],
    take: 4,
  })
}

export default async function HomePage() {
  const [candidates, categoryCounts, latestLifePosts, upcomingEvents] = await Promise.all([
    getHomepageBusinesses(),
    getCategoryCounts(),
    getLatestLifePosts(),
    getUpcomingEvents(),
  ])

  // Sort priority — shared with /search and category pages so listings
  // appear in a consistent, curated order everywhere:
  //   0 = Expert Partner (any combination — EP wins outright)
  //   1 = Best Of + (FEATURED or EXPERT_PARTNER tier)
  //   2 = (FEATURED or EXPERT_PARTNER tier) only
  //   3 = Best Of only
  //   4 = FREE (filtered out below, never reaches the homepage grid)
  const sorted = [...candidates].sort(compareBusinesses)

  const featuredBusinesses = sorted.map(b => ({
    ...b,
    isBestOf: b.isBestOfWinner,
    seHablaEspanol: b.seHablaEspanol,
    chamberMember: b.chamberMember,
    hispanicChamberMember: b.hispanicChamberMember,
  }))

  return (
    <>
      <JsonLd schema={WEBSITE_SCHEMA} />
      <JsonLd schema={ORGANIZATION_SCHEMA} />
      <HomePageClient
        featuredBusinesses={featuredBusinesses}
        categoryCounts={categoryCounts}
        latestLifePosts={latestLifePosts.map(p => ({
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          heroImageUrl: p.heroImageUrl,
          publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        }))}
        upcomingEvents={upcomingEvents.map(e => ({
          id: e.id,
          slug: e.slug,
          title: e.title,
          startsAt: e.startsAt.toISOString(),
          venueName: e.venueName,
          city: e.city,
          category: e.category,
          heroImageUrl: e.heroImageUrl,
          ticketUrl: e.ticketUrl,
          isFree: e.isFree,
          esEnEspanol: e.esEnEspanol,
          // Tier comes back as the enum string; cast for client component.
          tier: e.tier as 'HERO' | 'HONORABLE_MENTION',
          // business may be null when the event isn't linked to a local
          // listing (e.g. regional venues like RMA / Fox). Pass through.
          business: e.business ? { slug: e.business.slug, name: e.business.name } : null,
        }))}
      />
    </>
  )
}