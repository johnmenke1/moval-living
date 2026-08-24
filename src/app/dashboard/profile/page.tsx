import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ProfileForm } from './ProfileForm'
import { YourReviews } from './YourReviews'
import { EmailChangeForm } from './EmailChangeForm'
import { buildReviewsPageResponse } from './your-reviews-helpers'

export const metadata: Metadata = {
  title: 'Profile — moval.living',
  description: 'Edit your display name, avatar, and email preferences.',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?returnTo=/dashboard/profile')
  }

  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      emailOptIn: true,
      smsOptIn: true,
      emailVerified: true,
    },
  })
  if (!owner) {
    redirect('/login?returnTo=/dashboard/profile')
  }

  // Server-side fetch for the reviews list — hydrates the client
  // component with no flash of empty state. The client then polls
  // /api/profile/reviews every 30s for updates.
  const reviewRows = await prisma.review.findMany({
    where: { ownerId: owner.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      rating: true,
      content: true,
      authorName: true,
      authorEmail: true,
      response: true,
      flagged: true,
      createdAt: true,
      business: { select: { id: true, name: true, slug: true } },
    },
  })
  const initialReviews = reviewRows.map((r) =>
    buildReviewsPageResponse({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }),
  )

  return (
    <div className="bg-slate-50 min-h-screen py-10">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-text">Your profile</h1>
          <p className="text-text-secondary mt-1">
            Update how you appear on Best Of MoVal share cards and in the voter feed.
          </p>
        </div>

        <ProfileForm
          initialName={owner.name ?? ''}
          initialImage={owner.image}
          initialEmailOptIn={owner.emailOptIn}
          initialSmsOptIn={owner.smsOptIn}
          email={owner.email}
          emailVerified={Boolean(owner.emailVerified)}
        />

        <section className="mt-8">
          <h2 className="text-lg font-bold text-text mb-3">Your reviews</h2>
          <p className="text-xs text-text-secondary mb-3">
            Reviews you&apos;ve left on local businesses, newest first.
          </p>
          <YourReviews initialReviews={initialReviews} />
        </section>

        <EmailChangeForm currentEmail={owner.email} />
      </div>
    </div>
  )
}
