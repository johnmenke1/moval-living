import { redirect } from 'next/navigation'
import { auth } from '@/auth'

// This route consumes a one-time claim token and depends on the current
// authenticated session. It must never be prerendered at build time.
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { getAutoApprovedClaimData, isClaimValid } from '@/lib/claim-policy'

async function syncGhlClaimTags(email: string, opts: { emailOptIn: boolean }) {
  const token = process.env.GHL_API_TOKEN
  const loc = process.env.GHL_LOCATION_ID
  if (!token || !loc) return

  try {
    const lookup = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${loc}&email=${encodeURIComponent(email)}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
        },
      }
    )
    if (!lookup.ok) return
    const data = await lookup.json()
    if (!data.contacts || data.contacts.length === 0) return

    const contact = data.contacts[0]
    const existingTags: string[] = contact.tags || []
    const addTags = ['moval-living-listing-claimed']
    if (opts.emailOptIn) addTags.push('moval-living-opt-in')
    const removeTags = ['moval-living-cold-outreach']
    const newTags = Array.from(
      new Set([...existingTags.filter((t) => !removeTags.includes(t)), ...addTags])
    )
    if (newTags.length === existingTags.length && newTags.every((t, i) => t === existingTags[i])) {
      return // no change
    }

    await fetch(`https://services.leadconnectorhq.com/contacts/${contact.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: newTags }),
    })
  } catch (e) {
    // GHL sync is best-effort — never block the claim on it
    console.error('[claim-complete] GHL sync failed:', e)
  }
}

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

  // Sync GHL tags (best-effort, fire and forget)
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    select: { emailOptIn: true },
  })
  await syncGhlClaimTags(business.email || ownerEmail, {
    emailOptIn: owner?.emailOptIn ?? false,
  })

  redirect('/dashboard')
}
