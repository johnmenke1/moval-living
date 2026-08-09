import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/unsubscribe?t=<base64url-encoded-businessId:email>
// One-click unsubscribe (CAN-SPAM + List-Unsubscribe-Post compliance).
//
// Roadmap:
//  1. Decode the token (no auth needed; the token is the auth)
//  2. Find the Owner record by email (businesses imported from Google
//     don't have an Owner yet — that's fine, we just track it on the
//     Business record for the unsubscribe audit trail)
//  3. Set Owner.emailOptIn = false (if an owner exists)
//  4. Mark the Business so we don't re-send (via a contact-suppression list)
//  5. Show a confirmation page
//
// For now: simple confirmation page + DB write. Email suppression list
// (for the cold outreach script) is implemented as: any business with
// an OutreachUnsubscribedAt timestamp is skipped.

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) {
    return unsubscribePage('Invalid unsubscribe link.', false)
  }

  let businessId: string
  let email: string
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const [bid, em] = decoded.split(':')
    if (!bid || !em) throw new Error('malformed')
    businessId = bid
    email = em
  } catch {
    return unsubscribePage('Invalid unsubscribe link.', false)
  }

  // Find the business and record the unsubscribe
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, email: true },
  })

  if (!business || business.email !== email) {
    return unsubscribePage('We could not find that subscription. You may already be unsubscribed.', true)
  }

  // Mark on the Business record (raw JSON column — we don't have a
  // dedicated outreachSuppression field). The audience file (the
  // outreach script) reads this from rawSignals on the audit record.
  await prisma.businessAudit.create({
    data: {
      businessId,
      score: 0,
      httpStatus: null,
      finalUrl: null,
      pageLoadMs: null,
      contentLength: null,
      rawSignals: {
        outreachUnsubscribedAt: new Date().toISOString(),
        outreachChannel: 'email',
      } as any,
    },
  })

  // Return a friendly confirmation page
  return unsubscribePage(
    `You're unsubscribed from moval.living outreach emails. We won't email ${email} again.`,
    true
  )
}

function unsubscribePage(message: string, success: boolean): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Unsubscribed — moval.living</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; margin: 0; }
    .card { background: white; border-radius: 16px; padding: 32px; max-width: 480px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); text-align: center; }
    .icon { width: 56px; height: 56px; border-radius: 50%; background: ${success ? '#d1fae5' : '#fee2e2'}; color: ${success ? '#065f46' : '#991b1b'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 28px; }
    h1 { color: #1f2937; margin: 0 0 12px; font-size: 24px; }
    p { color: #6b7280; line-height: 1.6; margin: 0 0 24px; }
    a { color: #007a7f; text-decoration: none; font-weight: 500; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '✓' : '!'}</div>
    <h1>${success ? 'Unsubscribed' : 'Link problem'}</h1>
    <p>${message}</p>
    <p style="font-size: 14px;">
      <a href="https://moval.living">← Back to moval.living</a>
    </p>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: success ? 200 : 400,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}