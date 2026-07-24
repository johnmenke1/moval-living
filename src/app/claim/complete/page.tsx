import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Building2 } from 'lucide-react'

// GET /claim/complete?token=... — called after magic link fires.
// 1. Magic link created the session via NextAuth
// 2. We read the claim token from the URL and complete the ownership link
// 3. Redirect to dashboard
export default async function ClaimCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const session = await auth()
  const { token } = await searchParams

  if (!token) {
    redirect('/login')
  }

  if (!session?.user?.email) {
    redirect('/login')
  }

  // Complete the claim: link the business to this owner
  const business = await prisma.business.findUnique({
    where: { claimToken: token },
    select: { id: true, name: true, ownerId: true, claimExpiresAt: true },
  })

  if (business && !business.ownerId) {
    // Find or create owner by email
    let owner = await prisma.owner.findUnique({
      where: { email: session.user.email! },
    })

    if (!owner) {
      owner = await prisma.owner.create({
        data: {
          email: session.user.email!,
          name: session.user.name || null,
          image: session.user.image || null,
          emailVerified: new Date(),
        },
      })
    }

    // Complete the claim
    await prisma.business.update({
      where: { id: business.id },
      data: {
        ownerId: owner.id,
        claimToken: null,
        claimExpiresAt: null,
        // Also update the business email to match the owner's email if not set
        email: session.user.email!,
      },
    })
  }

  redirect('/dashboard')
}
