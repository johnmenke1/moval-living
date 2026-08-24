import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  emailChangeRequestSchema,
  EMAIL_CHANGE_TOKEN_BYTES,
  buildConfirmationUrl,
  computeTokenExpiry,
  isDifferentFromCurrent,
} from '@/app/api/profile/email-change-helpers'
import { sendEmailChangeConfirmationEmail } from '@/lib/email-change'

/**
 * POST /api/profile/email-change/request
 *
 * Owner-initiated email change. The owner submits a new email, we
 * generate a one-time token, store the request, and email the NEW
 * address with a confirmation link. The link is the secret — the
 * token never leaves the email server, and the owner must click
 * the link to swap.
 *
 * Flow:
 *   1. Auth required (401 if not signed in).
 *   2. Body validates via zod (400 on bad email).
 *   3. Reject if newEmail === current email (400 with specific msg).
 *   4. Reject if newEmail is already used by another Owner (409).
 *   5. Invalidate any prior pending requests for this owner.
 *   6. Generate token (32 bytes, base64url).
 *   7. Insert EmailChangeRequest with token + 1-hour TTL.
 *   8. SES-email the new address the confirmation link.
 *   9. Return 200 with `{ ok: true }` — the email send is
 *      fire-and-forget; failures are logged but don't block the
 *      response. The user can re-request to get a fresh link.
 *
 * Returns:
 *   - 200 { ok: true } on success
 *   - 400 on validation failure (bad email, same-as-current, etc)
 *   - 401 when not signed in
 *   - 409 when newEmail is already in use by another Owner
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { error: 'Sign in to change your email' },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = emailChangeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Invalid email',
      },
      { status: 400 },
    )
  }

  const newEmail = parsed.data.newEmail
  const currentEmail = session.user.email

  if (!isDifferentFromCurrent(newEmail, currentEmail)) {
    return NextResponse.json(
      { error: 'That is already your current email' },
      { status: 400 },
    )
  }

  // 4. Conflict check — the newEmail must not be in use by a
  // different Owner. We do this BEFORE generating the token so a
  // spammer can't probe for valid emails at the cost of sending
  // SES traffic.
  const conflict = await prisma.owner.findFirst({
    where: {
      email: newEmail,
      NOT: { id: session.user.id },
    },
    select: { id: true },
  })
  if (conflict) {
    return NextResponse.json(
      { error: 'That email is already in use by another account' },
      { status: 409 },
    )
  }

  // 5. Invalidate any prior pending requests for this Owner.
  // Deleting is cleaner than marking — these rows are short-lived
  // (1 hour TTL) and we never want a stale token to fire.
  await prisma.emailChangeRequest.deleteMany({
    where: {
      ownerId: session.user.id,
      usedAt: null,
    },
  })

  // 6. Generate a cryptographically random token.
  const token = randomBytes(EMAIL_CHANGE_TOKEN_BYTES)
    .toString('base64url')

  // 7. Persist.
  const expiresAt = computeTokenExpiry()
  await prisma.emailChangeRequest.create({
    data: {
      ownerId: session.user.id,
      newEmail,
      token,
      expiresAt,
    },
  })

  // 8. Build the URL + send the email.
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moval.living'
  const confirmationUrl = buildConfirmationUrl(baseUrl, token)

  // Fire-and-forget — failures are logged but don't block the
  // response. The owner can re-request to get a fresh link.
  void sendEmailChangeConfirmationEmail({
    toEmail: newEmail,
    toName: session.user.name ?? '',
    confirmationUrl,
  })

  return NextResponse.json({ ok: true })
}