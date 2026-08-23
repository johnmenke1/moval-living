import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ProfileForm } from './ProfileForm'

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

        <p className="mt-8 text-xs text-text-secondary text-center">
          Want to change your email address? That requires a confirmation
          flow and isn&apos;t available yet — email{' '}
          <a
            href="mailto:hello@moval.living"
            className="text-primary hover:underline"
          >
            hello@moval.living
          </a>{' '}
          if you need a hand.
        </p>
      </div>
    </div>
  )
}
