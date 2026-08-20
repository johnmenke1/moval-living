import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { InsightsHero } from '@/components/insights/InsightsHero'
import { InsightsArticlesGrid } from '@/components/insights/InsightsArticlesGrid'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Insights — Voices from MoVal Living',
  description:
    'Curated takes from local professionals, business owners, and community voices on life in Moreno Valley.',
  openGraph: {
    type: 'website',
    title: 'Insights — Voices from MoVal Living',
    description:
      'Curated takes from local professionals, business owners, and community voices on life in Moreno Valley.',
    url: 'https://www.moval.living/insights',
    images: [
      {
        url: '/insights-hero-collage.png',
        width: 1200,
        height: 630,
        alt: 'Insights — Community voices from Moreno Valley',
      },
    ],
  },
  alternates: { canonical: 'https://www.moval.living/insights' },
}

export default async function InsightsIndexPage() {
  const posts = await prisma.guestPost.findMany({
    where: { status: 'published', postType: 'GUEST' },
    orderBy: { publishedAt: 'desc' },
    include: {
      author: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          title: true,
          companyName: true,
          photoUrl: true,
        },
      },
    },
    take: 50,
  })

  return (
    <div className="min-h-screen">
      <InsightsHero />
      <InsightsArticlesGrid
        posts={posts.map(p => ({
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          heroImageUrl: p.heroImageUrl,
          publishedAt: p.publishedAt,
          author: p.author
            ? {
                id: p.author.id,
                slug: p.author.slug,
                displayName: p.author.displayName,
                title: p.author.title,
                companyName: p.author.companyName,
                photoUrl: p.author.photoUrl,
              }
            : null,
        }))}
      />
    </div>
  )
}
