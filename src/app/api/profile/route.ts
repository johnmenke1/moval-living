import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, owner as ownerTable, requireRow } from '@/db'
import { auth } from '@/auth'
import { profileSchema } from '@/app/dashboard/profile/profile-helpers'

/**
 * GET /api/profile
 *
 * Returns the current Owner's profile (name + image + email + opt-ins).
 * Used by /dashboard/profile to hydrate the form on first paint and
 * by /dashboard/page.tsx for the header avatar.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to view your profile' }, { status: 401 })
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
      lastBestOfVoteAt: true,
      createdAt: true,
    },
  })
  if (!owner) {
    return NextResponse.json({ error: 'Account not found' }, { status: 401 })
  }
  return NextResponse.json(owner)
}

/**
 * PATCH /api/profile
 *
 * Updates the current Owner's profile fields. Currently supports:
 *   - name (display name shown in vote snapshots + share cards)
 *   - emailOptIn (CAN-SPAM consent toggle)
 *   - smsOptIn (TCPA consent toggle)
 *
 * Email change + password change are intentionally NOT here — they
 * need their own confirmation flows (deferred to v1.1).
 *
 * The vote snapshot fields (voterNameSnapshot, voterImageSnapshot) are
 * NOT updated retroactively. Existing share cards keep the name the
 * voter had when they voted; future votes use the new name. This is
 * the same model as Google/Yelp.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to update your profile' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // smsOptIn has the same shape as emailOptIn — extract the extra
  // field from the body so the same zod schema can validate both.
  const smsOptIn = typeof (body as { smsOptIn?: unknown })?.smsOptIn === 'boolean'
    ? Boolean((body as { smsOptIn: boolean }).smsOptIn)
    : undefined

  const parsed = profileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid profile', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { name, emailOptIn } = parsed.data
  const now = new Date()

  // CAN-SPAM / TCPA: capture the consent timestamp when the user
  // explicitly opts in. We do NOT clear the timestamp on opt-out (so
  // we have a record of when they last consented).
  const owner = await db.query.owner.findFirst({
    where: eq(ownerTable.id, session.user.id),
    columns: {
      emailOptIn: true,
      smsOptIn: true,
      emailConsentAt: true,
      smsConsentAt: true,
    },
  })
  if (!owner) {
    return NextResponse.json({ error: 'Account not found' }, { status: 401 })
  }

  const data: {
    name: string
    emailOptIn: boolean
    smsOptIn?: boolean
    emailConsentAt?: Date | null
    smsConsentAt?: Date | null
    smsConsentSource?: string | null
  } = {
    name,
    emailOptIn,
  }
  if (emailOptIn && !owner.emailConsentAt) data.emailConsentAt = now

  if (smsOptIn !== undefined) {
    data.smsOptIn = smsOptIn
    if (smsOptIn && !owner.smsConsentAt) {
      data.smsConsentAt = now
      data.smsConsentSource = 'profile-page'
    }
  }

  const updated = requireRow(
    await db
      .update(ownerTable)
      .set(data)
      .where(eq(ownerTable.id, session.user.id))
      .returning({
        id: ownerTable.id,
        name: ownerTable.name,
        email: ownerTable.email,
        image: ownerTable.image,
        emailOptIn: ownerTable.emailOptIn,
        smsOptIn: ownerTable.smsOptIn,
      }),
    'Account not found'
  )

  return NextResponse.json(updated)
}