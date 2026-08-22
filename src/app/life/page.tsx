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

  // Answer capsule — server-rendered, first ~150 words of HTML.
  // AI engines (ChatGPT, Perplexity) lift this for queries like
  // 'what is it like to live in Moreno Valley?' The shape is a
  // complete factual answer: count + 3 most recent titles.
  const lifeCount = posts.length
  const recentTitles = posts
    .slice(0, 3)
    .map(p => `“${p.title}”`)
    .filter(Boolean)
  const lifeCapsule = lifeCount === 0
    ? 'Life in MoVal is a journal of what makes Moreno Valley a remarkable place to live — first essay coming soon.'
    : `Life in MoVal is a journal of ${lifeCount} essay${lifeCount === 1 ? '' : 's'} on what makes Moreno Valley a remarkable place to live. Recent stories: ${recentTitles.join(', ')}.`

  return (
    <div className="min-h-screen">
      <LifeHero />
      <div className="container-max pt-8 pb-2">
        <p className="text-base sm:text-lg text-text leading-relaxed max-w-3xl">
          {lifeCapsule}
        </p>
      </div>
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
