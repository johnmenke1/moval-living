import { MetadataRoute } from 'next'
import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { db, park as parkTable, business as businessTable, bestOfCategory, guestPost, guestAuthor, event as eventTable } from '@/db'
import { categories as directoryCategories } from '@/data/categories'

const BASE = 'https://www.moval.living'

// Sitemap pulls from live DB (businesses, Best-Of categories, editorial
// posts, events, partners, authors). The previous `force-dynamic` meant
// every crawler hit — Google, Bing, AI engines — re-ran six queries and
// pulled up to 5,000 rows from Neon. ISR with a 1-hour window replaces
// that: a fresh prerender rebuilds on the first request after expiry,
// and admin mutations call revalidatePath('/sitemap.xml') to invalidate
// the cache immediately on approval/delete. Crawlers see a stale
// snapshot for at most an hour between admin edits; the cost moves
// from "per-request, forever" to "per-request, hourly."
export const revalidate = 3600

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

  // Category landing pages — 22 static slugs from src/data/categories.ts.
  // /category/[slug] is the dedicated page for queries like "Moreno
  // Valley restaurants" and "plumbers in Moreno Valley" — the
  // directory's highest-leverage SEO surface.
  const categoryPages: MetadataRoute.Sitemap = directoryCategories.map(c => ({
    url: `${BASE}/category/${c.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Parks — /parks index is in staticPages above. Individual park
  // detail pages live at /parks/[slug] for active parks.
  const parks = await db.query.park.findMany({
    columns: { slug: true, updatedAt: true },
    where: eq(parkTable.isActive, true),
    orderBy: desc(parkTable.updatedAt),
  })

  const parkPages: MetadataRoute.Sitemap = parks.map(p => ({
    url: `${BASE}/parks/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  // Dynamic business pages — APPROVED only
  const businesses = await db.query.business.findMany({
    columns: { slug: true, updatedAt: true },
    where: eq(businessTable.status, 'APPROVED'),
    orderBy: desc(businessTable.updatedAt),
    limit: 5000,
  })

  const businessPages: MetadataRoute.Sitemap = businesses.map(b => ({
    url: `${BASE}/business/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // Dynamic BestOf category pages
  const categories = await db.query.bestOfCategory.findMany({
    columns: { slug: true, updatedAt: true },
    where: eq(bestOfCategory.published, true),
    orderBy: desc(bestOfCategory.updatedAt),
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
  const editorialPosts = await db.query.guestPost.findMany({
    where: and(
      eq(guestPost.status, 'published'),
      inArray(guestPost.postType, ['LIFE', 'GUEST', 'OUTING', 'SPOTLIGHT'])
    ),
    columns: { slug: true, postType: true, publishedAt: true, updatedAt: true },
    orderBy: desc(guestPost.publishedAt),
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
  const eventRows = await db.query.event.findMany({
    where: isNull(eventTable.archivedAt),
    columns: { slug: true, updatedAt: true, tier: true },
    orderBy: desc(eventTable.updatedAt),
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
  const partners = await db.query.business.findMany({
    columns: { slug: true, expertPartnerSlug: true, updatedAt: true },
    where: and(
      eq(businessTable.status, 'APPROVED'),
      eq(businessTable.isExpertPartner, true),
      isNotNull(businessTable.expertPartnerSlug)
    ),
    orderBy: desc(businessTable.updatedAt),
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
  const authors = await db.query.guestAuthor.findMany({
    columns: { slug: true, updatedAt: true },
    where: and(
      eq(guestAuthor.isActive, true),
      inArray(
        guestAuthor.id,
        db.select({ id: guestPost.authorId }).from(guestPost).where(eq(guestPost.status, 'published'))
      )
    ),
    orderBy: desc(guestAuthor.updatedAt),
  })

  const authorPages: MetadataRoute.Sitemap = authors.map(a => ({
    url: `${BASE}/authors/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  return [
    ...staticPages,
    ...categoryPages,
    ...parkPages,
    ...businessPages,
    ...bestOfPages,
    ...editorialPages,
    ...eventPages,
    ...partnerPages,
    ...authorPages,
  ]
}