import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getAutoApprovedClaimData, isClaimValid } from '@/lib/claim-policy'

export default async function ClaimCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const session = await auth()
  const { token } = await searchParams

  if (!token || !session?.user?.id || !session.user.email) {
    redirect('/login')
  }

  const ownerId = session.user.id
  const ownerEmail = session.user.email.toLowerCase()

  const business = await prisma.business.findUnique({
    where: { claimToken: token },
    select: { id: true, ownerId: true, claimExpiresAt: true },
  })

  if (!business || !isClaimValid(business)) {
    redirect('/claim?error=invalid-or-expired')
  }

  // Conditional update makes token consumption safe if the completion URL is
  // requested twice. A verified claim also publishes immediately by product
  // decision: possession of the claim link + verified mailbox is sufficient.
  const claimed = await prisma.$transaction(async tx => {
    const consumed = await tx.business.updateMany({
      where: {
        id: business.id,
        ownerId: null,
        claimToken: token,
        claimExpiresAt: { gt: new Date() },
      },
      data: {
        claimToken: null,
        claimExpiresAt: null,
      },
    })

    if (consumed.count !== 1) return false

    await tx.business.update({
      where: { id: business.id },
      data: {
        ...getAutoApprovedClaimData(ownerId),
        email: ownerEmail,
      },
    })
    return true
  })

  if (!claimed) {
    redirect('/claim?error=already-claimed')
  }

  redirect('/dashboard')
}
