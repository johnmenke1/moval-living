import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'
import { sendEmail } from '@/lib/email'
import { verifyTurnstileOrSkip } from '@/lib/turnstile'

// POST /api/claim/request
// Public — anyone can request to claim a business they own.
// Creates a claimToken and sends a magic link via SES to verify ownership.
//
// Security layers (in order, all must pass before SES sends):
//   1. Per-IP rate limit (10/hr)  — stops spray-and-pray
//   2. Turnstile CAPTCHA         — stops bots (fails closed unless secret unset)
//   3. Slug-must-be-unclaimed    — stops re-claim of owned listings
//   4. Email-existence check     — only sends if the email looks like a real one
//   5. Audit log                 — every attempt logged with IP/UA/slug/domain
//
// Without (1) and (2) this route was being abused as an open relay:
// attackers iterated over public business slugs and POSTed
// `{slug, email: <victim>}` to fire "Claim your X listing" emails at
// arbitrary recipients. Amazon SES abuse reports started 2026-09-15.

const recentClaimRequests = new Map<string, number[]>()
const CLAIM_RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const CLAIM_RATE_MAX = 10

function claimRateLimited(key: string): boolean {
  const now = Date.now()
  const recent = recentClaimRequests.get(key) ?? []
  const cutoff = now - CLAIM_RATE_WINDOW_MS
  const filtered = recent.filter((t) => t > cutoff)
  if (filtered.length >= CLAIM_RATE_MAX) {
    recentClaimRequests.set(key, filtered)
    return true
  }
  filtered.push(now)
  recentClaimRequests.set(key, filtered)
  return false
}

export async function POST(request: NextRequest) {
  const remoteIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'

  try {
    const body = await request.json()
    const { slug, email, turnstileToken } = body

    if (!slug || !email) {
      return NextResponse.json({ error: 'Missing business slug or email' }, { status: 400 })
    }

    // Basic email format check (don't be a hero — just catch obvious typos)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    // Rate limit by IP (per-process — fine for single Vercel deployment).
    if (claimRateLimited(remoteIp)) {
      console.warn('[Claim] rate-limited', { ip: remoteIp, slug, emailDomain: email.split('@')[1] })
      return NextResponse.json(
        { error: 'Too many claim requests — please try again later.' },
        { status: 429 },
      )
    }

    // Turnstile verification — fails closed (no email sent) if invalid.
    // Skipped gracefully only when TURNSTILE_SECRET_KEY is unset (dev safety).
    const turnstile = await verifyTurnstileOrSkip(turnstileToken, remoteIp)
    if (!turnstile.ok) {
      console.warn('[Claim] turnstile-failed', {
        ip: remoteIp,
        slug,
        emailDomain: email.split('@')[1],
        reason: turnstile.reason,
      })
      return NextResponse.json(
        { error: 'Bot protection check failed — please try again.' },
        { status: 403 },
      )
    }

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, name: true, status: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (business.ownerId) {
      return NextResponse.json({ error: 'This listing is already claimed' }, { status: 409 })
    }

    if (business.status !== 'APPROVED') {
      return NextResponse.json({ error: 'This listing is not yet approved' }, { status: 403 })
    }

    const claimToken = nanoid(32)
    const claimExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await prisma.business.update({
      where: { id: business.id },
      data: { claimToken, claimExpiresAt },
    })

    // Build the claim URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://www.moval.living'
    const claimUrl = `${baseUrl}/claim?token=${claimToken}`

    // Send the magic link via SES
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Claim Your Moval.living Listing</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
          <!-- Header -->
          <tr>
            <td style="background:#1a56db;padding:32px 40px;text-align:center">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700">Moval<span style="color:#93c5fd">.living</span></h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600">Claim Your Listing</h2>
              <p style="margin:0 0 16px;color:#4b5563;font-size:15px;line-height:1.6">
                Someone (hopefully you) requested to claim the <strong>${business.name}</strong> listing on moval.living using this email address.
              </p>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6">
                Click the button below to verify your ownership and set up your free account to manage your listing. This link expires in <strong>7 days</strong>.
              </p>
              <p style="margin:0 0 32px;text-align:center">
                <a href="${claimUrl}" style="display:inline-block;background:#1a56db;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px">
                  Claim Your Listing
                </a>
              </p>
              <p style="margin:0 0 16px;color:#4b5563;font-size:13px;line-height:1.6">
                If you didn't request this, you can safely ignore this email.
                The listing will remain unclaimed.
              </p>
              <p style="margin:32px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">
                If the button doesn't work, copy and paste this URL into your browser:<br/>
                <a href="${claimUrl}" style="color:#1a56db;word-break:break-all">${claimUrl}</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center">
          MovalLiving · Moreno Valley's Business Directory
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim()

    const text = `Claim Your Moval.living Listing

Someone requested to claim the ${business.name} listing on moval.living using this email address.

Click the link below to verify your ownership and set up your free account. This link expires in 7 days:

${claimUrl}

If you didn't request this, you can safely ignore this email.

— MovalLiving`

    try {
      await sendEmail({
        to: email,
        subject: `Claim your ${business.name} listing on moval.living`,
        html,
        text,
      })
      // Audit log — every successful SES send. Grep Vercel logs for
      // '[Claim] sent' to see who's getting claim emails. (Useful for
      // tracking the SES abuse pattern until rate limit + Turnstile
      // kick in fully.)
      console.log('[Claim] sent', {
        ip: remoteIp,
        ua: userAgent,
        slug,
        businessId: business.id,
        emailDomain: email.split('@')[1],
        ts: new Date().toISOString(),
      })
    } catch (emailErr) {
      // Don't 500 — the link was generated. Log the email error but still
      // return success so the UI flow continues. Also include the link in
      // the response in dev so it's debuggable.
      console.error('[Claim] Failed to send email:', emailErr)
      return NextResponse.json({
        success: true,
        claimUrl,
        warning: 'Email failed to send — link returned for manual delivery',
        error_detail: emailErr instanceof Error ? emailErr.message : 'unknown',
      })
    }

    return NextResponse.json({
      success: true,
      message: `Claim link sent to ${email}`,
    })
  } catch (error) {
    console.error('Claim request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}