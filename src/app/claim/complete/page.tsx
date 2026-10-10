import { redirect } from 'next/navigation'
import { auth } from '@/auth'

// This route consumes a one-time claim token and depends on the current
// authenticated session. It must never be prerendered at build time.
export const dynamic = 'force-dynamic'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db, business as businessTable, owner as ownerTable } from '@/db'
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

  const business = await db.query.business.findFirst({
    where: eq(businessTable.claimToken, token),
    columns: { id: true, ownerId: true, claimExpiresAt: true, email: true },
  })

  if (!business || !isClaimValid(business)) {
    redirect('/claim?error=invalid-or-expired')
  }

  // Conditional update makes token consumption safe if the completion URL is
  // requested twice. A verified claim also publishes immediately by product
  // decision: possession of the claim link + verified mailbox is sufficient.
  const claimed = await db.transaction(async tx => {
    const consumed = await tx
      .update(businessTable)
      .set({ claimToken: null, claimExpiresAt: null })
      .where(
        and(
          eq(businessTable.id, business.id),
          isNull(businessTable.ownerId),
          eq(businessTable.claimToken, token),
          gt(businessTable.claimExpiresAt, new Date())
        )
      )
      .returning({ id: businessTable.id })

    if (consumed.length !== 1) return false

    await tx
      .update(businessTable)
      .set({ ...getAutoApprovedClaimData(ownerId), email: ownerEmail })
      .where(eq(businessTable.id, business.id))
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
  const owner = await db.query.owner.findFirst({
    where: eq(ownerTable.id, ownerId),
    columns: { name: true },
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
