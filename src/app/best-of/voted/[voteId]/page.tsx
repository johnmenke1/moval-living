import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { buildCanonicalShareUrl, buildShareMessage } from './voted-helpers'
import { VoteShareCard } from '@/components/best-of/VoteShareCard'
import { VoteShareActions } from '@/components/best-of/VoteShareActions'

interface Props {
  params: Promise<{ voteId: string }>
}

const SITE_URL = 'https://www.moval.living'

/**
 * Fetch a single BestOfVote + its nominee + category. Returns null if
 * the vote doesn't exist (the route will 404). We deliberately don't
 * filter by `voterId === session.user.id` here — this page is public
 * because the share URL is the whole point. The visible voter identity
 * is whatever the voter chose at vote-time (snapshotted on the row),
 * so retracting the vote in v1.1 means a separate retraction on the
 * /best-of/[category] page, not here.
 */
async function getVote(voteId: string) {
  return prisma.bestOfVote.findUnique({
    where: { id: voteId },
    select: {
      id: true,
      voterNameSnapshot: true,
      voterImageSnapshot: true,
      createdAt: true,
      nominee: {
        select: {
          id: true,
          business: {
            select: { id: true, name: true, slug: true, logo: true },
          },
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { voteId } = await params
  const vote = await getVote(voteId)
  if (!vote) return { title: 'Vote not found' }

  const pageUrl = buildCanonicalShareUrl(voteId, SITE_URL)
  const title = `${vote.voterNameSnapshot} voted for ${vote.nominee.business.name}`
  const description = `See who voted for ${vote.nominee.business.name} in the Best Of MoVal — ${vote.nominee.category.name} category.`

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'article',
      url: pageUrl,
      title,
      description,
      // Dynamic OG image (voter card) lands in Task 13. Until then,
      // fall back to the category-level static OG card so the share
      // preview doesn't break.
      images: [`/og/${vote.nominee.category.slug}.png`],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/og/${vote.nominee.category.slug}.png`],
    },
    robots: { index: false, follow: false },
  }
}

export default async function VotedPage({ params }: Props) {
  const { voteId } = await params
  const vote = await getVote(voteId)
  if (!vote) notFound()

  const pageUrl = buildCanonicalShareUrl(voteId, SITE_URL)
  const shareMessage = buildShareMessage({
    voterName: vote.voterNameSnapshot,
    nomineeName: vote.nominee.business.name,
    categoryName: vote.nominee.category.name,
  })

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-amber-50 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header: success state + share copy */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-text">
            You voted!
          </h1>
          <p className="text-text-secondary mt-2">
            Thanks for shaping Best Of MoVal. Share your pick with friends
            and family — every vote makes the ballot more representative.
          </p>
        </div>

        {/* The share card preview — this is what gets screenshotted
            and shared on social. Rendered as the actual JSX so the
            preview matches the eventual OG image once Task 13 ships. */}
        <VoteShareCard
          voterName={vote.voterNameSnapshot}
          voterImage={vote.voterImageSnapshot}
          nomineeName={vote.nominee.business.name}
          nomineeLogo={vote.nominee.business.logo}
          nomineeSlug={vote.nominee.business.slug}
          categoryName={vote.nominee.category.name}
          categorySlug={vote.nominee.category.slug}
        />

        {/* Share CTAs — both Web Share API + clipboard fallback */}
        <div className="mt-8 space-y-3">
          <VoteShareActions
            pageUrl={pageUrl}
            shareMessage={shareMessage}
            voteId={voteId}
          />
        </div>

        {/* Back link + privacy note */}
        <div className="mt-10 text-center space-y-2">
          <Link
            href={`/best-of/${vote.nominee.category.slug}`}
            className="text-primary hover:underline font-medium"
          >
            ← Back to {vote.nominee.category.name}
          </Link>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Heads up: this page is shareable. Sharing the link will show
            your name and avatar to whoever you send it to. You can retract
            your vote from the category page at any time.
          </p>
        </div>
      </div>
    </div>
  )
}

// Client component for the share buttons lives in
// components/best-of/VoteShareActions.tsx (imported above).
