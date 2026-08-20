import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { LifeHero } from '@/components/life/LifeHero'
import { LifeArticlesGrid } from '@/components/life/LifeArticlesGrid'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Life in MoVal — John Menke',
  description:
    'Observations and reflections on what makes Moreno Valley a remarkable place to live.',
  openGraph: {
    type: 'website',
    title: 'Life in MoVal — John Menke',
    description:
      'Observations and reflections on what makes Moreno Valley a remarkable place to live.',
    url: 'https://www.moval.living/life',
    images: [
      {
        url: '/life-hero-collage.png',
        width: 1200,
        height: 630,
        alt: 'Life in MoVal — scenes from Moreno Valley',
      },
    ],
  },
  alternates: { canonical: 'https://www.moval.living/life' },
}

export default async function LifeIndexPage() {
  const posts = await prisma.guestPost.findMany({
    where: { status: 'published', postType: 'LIFE' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  })

  return (
    <div className="min-h-screen">
      <LifeHero />
      <LifeArticlesGrid
        posts={posts.map(p => ({
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          heroImageUrl: p.heroImageUrl,
          publishedAt: p.publishedAt,
        }))}
      />
    </div>
  )
}
