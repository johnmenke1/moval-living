import { redirect } from 'next/navigation'
import { auth } from '@/auth'

// This route consumes a one-time claim token and depends on the current
// authenticated session. It must never be prerendered at build time.
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { getAutoApprovedClaimData, isClaimValid } from '@/lib/claim-policy'
import { notifyCrmOfClaimChange } from '@/lib/moval-claim/notify-crm'

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
    select: { id: true, ownerId: true, claimExpiresAt: true, email: true },
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

  // Notify HeadsUpCRM of the new claim state so its moval-businesses
  // mirror row reflects 'verified'. Best-effort: the page must not block
  // on this, and the CRM has a daily catch-up cron that will sync any
  // claim event this call missed (network blip, CRM deploy, secret
  // rotation, etc).
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    select: { name: true },
  })
  await notifyCrmOfClaimChange({
    websiteBusinessId: business.id,
    event: 'claimed',
    claimedAt: new Date().toISOString(),
    ownerEmail,
    ownerName: owner?.name ?? undefined,
  })

  redirect('/dashboard')
}
