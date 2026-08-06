import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const BASE = 'https://moval.living'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/search`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/best-of`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/about-moreno-valley`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/events`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/open-houses`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/deals`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/submit`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]

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

  return [...staticPages, ...businessPages, ...bestOfPages]
}
