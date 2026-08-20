import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { OutingsHero } from '@/components/outings/OutingsHero'
import { OutingsMagazineGrid } from '@/components/outings/OutingsMagazineGrid'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Live Curiously — Outings in Moreno Valley',
  description:
    'Photo essays from John Menke exploring the hidden gems and must-see destinations around Moreno Valley and the broader Inland Empire.',
  openGraph: {
    type: 'website',
    title: 'Live Curiously — Outings in Moreno Valley',
    description:
      'Weekend day trips, photo essays, and short escapes from Moreno Valley — by car, by train, and by trail.',
    url: 'https://www.moval.living/outings',
  },
  alternates: { canonical: 'https://www.moval.living/outings' },
}

export default async function OutingsIndexPage() {
  const posts = await prisma.guestPost.findMany({
    where: { status: 'published', postType: 'OUTING' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  })

  return (
    <div className="min-h-screen">
      <OutingsHero posts={posts} />
      <OutingsMagazineGrid
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
