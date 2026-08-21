import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const BASE = 'https://www.moval.living'

// Sitemap pulls from live DB (businesses, Best-Of categories, editorial
// posts). Without force-dynamic, Vercel prerenders this at build time and
// the prerender survives subsequent deploys — admin-curated additions
// stay invisible until the cache expires naturally. force-dynamic ensures
// every request hits the live DB. Same fix as src/app/best-of/page.tsx.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/search`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/parks`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${BASE}/best-of`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/about-moreno-valley`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/events`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/open-houses`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/deals`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/submit`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/link`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/submit/best-of`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/submit/event`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/life`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/insights`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/outings`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/spotlights`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/partners`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/homes`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
    { url: `${BASE}/chamber`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/hispanic-chamber`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ]

  // Parks — /parks index is in staticPages above. Individual park
  // detail pages live at /parks/[slug] for active parks.
  const parks = await prisma.park.findMany({
    select: { slug: true, updatedAt: true },
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  })

  const parkPages: MetadataRoute.Sitemap = parks.map(p => ({
    url: `${BASE}/parks/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  // Dynamic business pages — APPROVED only
  const businesses = await prisma.business.findMany({
    select: { slug: true, updatedAt: true },
    where: { status: 'APPROVED' },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  })

  const businessPages: MetadataRoute.Sitemap = businesses.map(b => ({
    url: `${BASE}/business/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // Dynamic BestOf category pages
  const categories = await prisma.bestOfCategory.findMany({
    select: { slug: true, updatedAt: true },
    where: { published: true },
    orderBy: { updatedAt: 'desc' },
  })

  const bestOfPages: MetadataRoute.Sitemap = categories.map(c => ({
    url: `${BASE}/best-of/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  // Dynamic editorial posts — all four postTypes:
  //   LIFE      → /life/[slug]
  //   GUEST     → /insights/[slug]
  //   OUTING    → /outings/[slug]
  //   SPOTLIGHT → /spotlights/[slug]
  // Surfacing all four means crawlers can discover outings & spotlights
  // through the sitemap even before external links point at them.
  const editorialPosts = await prisma.guestPost.findMany({
    where: {
      status: 'published',
      postType: { in: ['LIFE', 'GUEST', 'OUTING', 'SPOTLIGHT'] },
    },
    select: { slug: true, postType: true, publishedAt: true, updatedAt: true },
    orderBy: { publishedAt: 'desc' },
  })

  const postTypeToPath: Record<string, string> = {
    LIFE: 'life',
    GUEST: 'insights',
    OUTING: 'outings',
    SPOTLIGHT: 'spotlights',
  }

  const editorialPages: MetadataRoute.Sitemap = editorialPosts.map(p => ({
    url: `${BASE}/${postTypeToPath[p.postType] ?? 'life'}/${p.slug}`,
    lastModified: p.updatedAt ?? p.publishedAt ?? now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  // Event detail pages — every non-archived event with a slug. The
  // /events/[slug] route renders Schema.org Event JSON-LD server-side
  // and gives each event its own indexable URL for "things to do in
  // Moreno Valley" long-tail queries. Priority boosts HERO events.
  const eventRows = await prisma.event.findMany({
    where: { archivedAt: null },
    select: { slug: true, updatedAt: true, tier: true },
    orderBy: { updatedAt: 'desc' },
  })

  const eventPages: MetadataRoute.Sitemap = eventRows.map((ev) => ({
    url: `${BASE}/events/${ev.slug}`,
    lastModified: ev.updatedAt,
    changeFrequency: 'weekly',
    priority: ev.tier === 'HERO' ? 0.8 : ev.tier === 'HONORABLE_MENTION' ? 0.7 : 0.6,
  }))

  // Expert Partner detail pages — Business rows that opted into the
  // Expert Partner program. The detail route uses expertPartnerSlug
  // (falls back to slug if missing).
  const partners = await prisma.business.findMany({
    select: { slug: true, expertPartnerSlug: true, updatedAt: true },
    where: { status: 'APPROVED', isExpertPartner: true, expertPartnerSlug: { not: null } },
    orderBy: { updatedAt: 'desc' },
  })

  const partnerPages: MetadataRoute.Sitemap = partners.map(p => ({
    url: `${BASE}/partners/${p.expertPartnerSlug ?? p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  // Active guest authors with at least one published post — author
  // profile pages at /authors/[slug]. We filter to active authors and
  // rely on the detail route's own published-post filter to avoid
  // surfacing empty profiles.
  const authors = await prisma.guestAuthor.findMany({
    select: { slug: true, updatedAt: true, _count: { select: { posts: true } } },
    where: {
      isActive: true,
      posts: { some: { status: 'published' } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const authorPages: MetadataRoute.Sitemap = authors.map(a => ({
    url: `${BASE}/authors/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  return [
    ...staticPages,
    ...parkPages,
    ...businessPages,
    ...bestOfPages,
    ...editorialPages,
    ...eventPages,
    ...partnerPages,
    ...authorPages,
  ]
}