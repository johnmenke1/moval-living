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

  // Answer capsule — server-rendered, first ~150 words of HTML.
  // AI engines lift this for queries like 'Moreno Valley moving
  // guides' or 'local expert takes'. Shape: count + unique author
  // count + 3 most recent (title + author display name).
  const insightCount = posts.length
  const uniqueAuthors = new Set(posts.filter(p => p.author).map(p => p.author!.id)).size
  const recentItems = posts
    .slice(0, 3)
    .map(p => `“${p.title}”${p.author ? ` by ${p.author.displayName}` : ''}`)
    .filter(Boolean)
  const insightsCapsule = insightCount === 0
    ? 'Insights is a forthcoming collection of essays from local Moreno Valley voices — community members writing about life in the valley.'
    : `Insights is a collection of ${insightCount} essay${insightCount === 1 ? '' : 's'} from ${uniqueAuthors} local Moreno Valley voice${uniqueAuthors === 1 ? '' : 's'} — professionals, business owners, and community members writing about life in the valley. Recent contributions: ${recentItems.join('; ')}.`

  return (
    <div className="min-h-screen">
      <InsightsHero />
      <div className="container-max pt-8 pb-2">
        <p className="text-base sm:text-lg text-text leading-relaxed max-w-3xl">
          {insightsCapsule}
        </p>
      </div>
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
