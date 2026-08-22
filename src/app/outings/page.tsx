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

  // Answer capsule — server-rendered, first ~150 words of HTML.
  // AI engines lift this for queries like 'day trips from Moreno
  // Valley'. Shape: count + 3 most recent titles + scope hint.
  const outingCount = posts.length
  const recentTitles = posts
    .slice(0, 3)
    .map(p => `“${p.title}”`)
    .filter(Boolean)
  const outingCapsule = outingCount === 0
    ? 'Outings from Moreno Valley covers day trips and short escapes within driving distance of the Inland Empire — first photo essay coming soon.'
    : `Outings from Moreno Valley covers ${outingCount} day trip${outingCount === 1 ? '' : 's'} and short escapes within driving distance of the Inland Empire. Recent photo essays: ${recentTitles.join(', ')}. Most are 1-2 hour drives; some are Metrolink-accessible.`

  return (
    <div className="min-h-screen">
      <OutingsHero posts={posts} />
      <div className="container-max pt-8 pb-2">
        <p className="text-base sm:text-lg text-text leading-relaxed max-w-3xl">
          {outingCapsule}
        </p>
      </div>
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
