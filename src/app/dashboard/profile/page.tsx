import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { desc, eq } from 'drizzle-orm'
import { db, owner as ownerTable, review, eventAttendee } from '@/db'
import { ProfileForm } from './ProfileForm'
import { YourReviews } from './YourReviews'
import { EmailChangeForm } from './EmailChangeForm'
import { YourEvents } from './YourEvents'
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

  const owner = await db.query.owner.findFirst({
    where: eq(ownerTable.id, session.user.id),
    columns: {
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
  const reviewRows = await db.query.review.findMany({
    where: eq(review.ownerId, owner.id),
    orderBy: desc(review.createdAt),
    limit: 50,
    columns: {
      id: true,
      rating: true,
      content: true,
      authorName: true,
      authorEmail: true,
      response: true,
      flagged: true,
      createdAt: true,
    },
    with: { business: { columns: { id: true, name: true, slug: true } } },
  })
  const initialReviews = reviewRows.map((r) =>
    buildReviewsPageResponse({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }),
  )

  // Server-side fetch for the user's RSVPed events.
  const attendeeRows = await db.query.eventAttendee.findMany({
    where: eq(eventAttendee.ownerId, owner.id),
    orderBy: desc(eventAttendee.createdAt),
    columns: { id: true, status: true },
    with: {
      event: {
        columns: {
          id: true,
          slug: true,
          title: true,
          startsAt: true,
          venueName: true,
          city: true,
          heroImageUrl: true,
        },
      },
    },
  })

  const toProfileEvent = (r: (typeof attendeeRows)[number]) => ({
    id: r.event.id,
    attendeeId: r.id,
    slug: r.event.slug,
    title: r.event.title,
    startsAt: r.event.startsAt.toISOString(),
    venueName: r.event.venueName,
    city: r.event.city,
    heroImageUrl: r.event.heroImageUrl,
  })

  const initialAttending = attendeeRows
    .filter((r) => r.status === 'GOING')
    .map(toProfileEvent)
  const initialInterested = attendeeRows
    .filter((r) => r.status === 'INTERESTED')
    .map(toProfileEvent)

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

        <section className="mt-8">
          <h2 className="text-lg font-bold text-text mb-3">Your events</h2>
          <p className="text-xs text-text-secondary mb-3">
            Events you&apos;ve said you&apos;re attending or interested in.
          </p>
          <YourEvents initialAttending={initialAttending} initialInterested={initialInterested} />
        </section>

        <EmailChangeForm currentEmail={owner.email} />
      </div>
    </div>
  )
}
