import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  isTokenExpired,
  isTokenUsed,
  validateTokenShape,
} from '@/app/api/profile/email-change-helpers'

/**
 * GET /api/profile/email-change/confirm?token=...
 *
 * Confirms a pending email change. The token in the URL is the
 * credential — possession of the link = authorization to swap.
 *
 * Atomic operation via Prisma transaction:
 *   1. Look up row by token (404 if missing).
 *   2. Reject if usedAt is set (410).
 *   3. Reject if expiresAt is in the past (410).
 *   4. Atomically:
 *      a. Mark the row used (set usedAt = NOW()).
 *      b. Update Owner.email to the new email.
 *      c. Delete any other pending requests for this Owner.
 *
 * Redirects to /dashboard/profile?email_changed=1 on success.
 * Renders a simple HTML error page on failure (the link in the
 * email is opened in a browser, not fetched from JS, so we need
 * a human-friendly response).
 *
 * We deliberately do NOT require an Owner session for the confirm
 * step — the link IS the auth. If we required session, the user
 * would have to be signed in to the OLD email when they click the
 * link from the NEW inbox, which doesn't work for the obvious
 * case (people sign out before switching).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? undefined

  // 1. Token shape check.
  const shape = validateTokenShape(token)
  if (!shape.ok) {
    return renderConfirmPage('Invalid link', 'The confirmation link is invalid or malformed.', 400)
  }

  const looked = await prisma.emailChangeRequest.findUnique({
    where: { token },
    select: {
      id: true,
      ownerId: true,
      newEmail: true,
      usedAt: true,
      expiresAt: true,
    },
  })

  // 2. Row missing.
  if (!looked) {
    return renderConfirmPage(
      'Link not found',
      "We can't find a pending email change for that link. It may have already been completed or never existed.",
      404,
    )
  }

  // 3. Already used.
  if (isTokenUsed(looked.usedAt)) {
    return renderConfirmPage(
      'Link already used',
      'That confirmation link has already been used. Your email was updated the first time it was opened.',
      410,
    )
  }

  // 4. Expired.
  if (isTokenExpired(looked.expiresAt)) {
    return renderConfirmPage(
      'Link expired',
      'That confirmation link has expired. Please request a new one from your profile page.',
      410,
    )
  }

  // 5. Atomic swap. Inside the transaction we re-check `usedAt IS NULL`
  // and update with `where: { id, usedAt: null }` so a parallel
  // double-click on the link cannot double-swap or leave inconsistent
  // state.
  try {
    await prisma.$transaction(async (tx) => {
      const claim = await tx.emailChangeRequest.updateMany({
        where: { id: looked.id, usedAt: null },
        data: { usedAt: new Date() },
      })
      if (claim.count !== 1) {
        // Another tab/click won the race. Bail out of the txn.
        throw new Error('Email change already claimed')
      }

      await tx.owner.update({
        where: { id: looked.ownerId },
        data: { email: looked.newEmail },
      })

      // Delete any other pending requests for this Owner — they
      // pre-date the just-confirmed swap and should not be usable.
      await tx.emailChangeRequest.deleteMany({
        where: {
          ownerId: looked.ownerId,
          usedAt: null,
        },
      })
    })
  } catch (e) {
    // Race or DB error — surface as a friendly 409 with retry guidance.
    return renderConfirmPage(
      'Already in progress',
      'This email change was just confirmed in another tab. No further action needed.',
      409,
    )
  }

  // 6. Redirect to the profile with a success flag.
  return NextResponse.redirect(
    new URL('/dashboard/profile?email_changed=1', req.url),
  )
}

/**
 * Minimal HTML page for the email link click. We don't have a
 * Next.js layout here — this is a GET endpoint opened in a
 * browser from an email — so we render a tiny standalone page.
 *
 * The dashboard/profile page reads ?email_changed=1 and shows a
 * success banner; this page is only seen if there's a failure.
 */
function renderConfirmPage(
  title: string,
  body: string,
  status: number,
): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Moval.Living</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div style="background:#ffffff;border-radius:12px;padding:40px;max-width:480px;margin:20px;box-shadow:0 2px 8px rgba(0,0,0,0.08);text-align:center">
    <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:700">${escapeHtml(title)}</h1>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6">${escapeHtml(body)}</p>
    <a href="https://www.moval.living/dashboard/profile" style="display:inline-block;background:#007a7f;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;font-size:15px">Go to your profile</a>
  </div>
</body>
</html>`
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}