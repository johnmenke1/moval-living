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
    { url: `${BASE}/life`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/insights`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/chamber`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/hispanic-chamber`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ]

  // Parks — the /parks index page is referenced above. Individual parks
  // are not yet URL-routable (each park lives at the #slug anchor in
  // the index). When we add /parks/[slug] route, append a `parkPages`
  // block here mirroring the `businessPages` pattern.

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

  // Dynamic editorial posts — Life in MoVal (LIFE) + Guest Insights (GUEST)
  // Both already have their own [slug] route handler and force-dynamic rendering;
  // surfacing them here is what makes Google actually find the articles.
  const editorialPosts = await prisma.guestPost.findMany({
    where: { status: 'published', postType: { in: ['LIFE', 'GUEST'] } },
    select: { slug: true, postType: true, publishedAt: true, updatedAt: true },
    orderBy: { publishedAt: 'desc' },
  })

  const editorialPages: MetadataRoute.Sitemap = editorialPosts.map(p => ({
    url: `${BASE}/${
      p.postType === 'GUEST' ? 'insights' : 'life'
    }/${p.slug}`,
    lastModified: p.updatedAt ?? p.publishedAt ?? now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...staticPages, ...businessPages, ...bestOfPages, ...editorialPages]
}
