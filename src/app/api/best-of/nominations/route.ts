import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import {
  syncNominatorToGHL,
  attachGhlContactId,
  sendThankYouEmail,
  notifyAdminOfNomination,
} from '@/lib/best-of-nominations'

const nominationSchema = z.object({
  // Free-text — what the user typed for the business name. We fuzzy-match
  // against the Business table server-side to populate businessId if
  // there's an APPROVED business with the same name (case-insensitive).
  businessName: z.string().trim().min(2).max(200),
  // Free-text — the suggested category name. Always captured as-is, even
  // if it matches an existing BestOfCategory, so the admin sees how the
  // nominator phrased it.
  categoryName: z.string().trim().min(2).max(120),
  nominatorName: z.string().trim().min(1).max(120),
  nominatorEmail: z.string().trim().email().max(320),
  reason: z.string().trim().min(20).max(600), // ~600 chars cap; UI nudges 80+
  // Captured consents (CAN-SPAM / 10DLC / TCPA)
  emailOptIn: z.boolean().optional().default(false),
  // Honeypot — must be empty. Bots fill every field they see; real users
  // can't see this one (it's hidden in the form with CSS).
  website: z.string().max(0).optional().or(z.literal('')),
})

// In-memory rate limiter — 5 nominations per IP per hour.
// Matches the pattern from /api/partners/[slug]/leads/route.ts. Sufficient
// for MoVal.Living's traffic on a single Vercel deployment; for multi-
// instance production we'd swap to Upstash Redis or Vercel KV.
const recentSubmissions = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 5

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const recent = recentSubmissions.get(key) ?? []
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const filtered = recent.filter((t) => t > cutoff)
  if (filtered.length >= RATE_LIMIT_MAX) {
    recentSubmissions.set(key, filtered)
    return false
  }
  filtered.push(now)
  recentSubmissions.set(key, filtered)
  return true
}

export async function POST(req: NextRequest) {
  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = nominationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // Honeypot — if filled, silently 200 so bots don't retry.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ ok: true })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  // Rate limit by IP. (Not by email — public form, no auth, a determined
  // spammer could rotate IPs but they'd also need to rotate emails which
  // is more friction than this list of likely targets justifies.)
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many submissions — please try again later.' },
      { status: 429 }
    )
  }

  // Fuzzy-match the business name against APPROVED businesses. We don't
  // require an exact match — if there's no candidate we just leave
  // businessId null and the admin can match or create during moderation.
  // Per Johnny's choice (Q4=B): match against all businesses regardless of
  // status, but only suggest matches for the admin — never auto-link.
  const candidate = await prisma.business.findFirst({
    where: {
      name: { equals: parsed.data.businessName, mode: 'insensitive' },
    },
    select: { id: true, status: true, name: true },
  })
  const businessId = candidate?.id ?? null

  // If the nominator is signed in, link the nomination to their Owner
  // account so it shows up in /dashboard/profile alongside their reviews
  // and votes. nominatorName + nominatorEmail stay authoritative for
  // display (snapshot pattern, same as Review + BestOfVote). Anonymous
  // submissions still work — ownerId stays null.
  const session = await auth()
  const ownerId = session?.user?.id ?? null

  // Save the nomination locally first — GHL/SES failures must not block
  // the form. Everything downstream is fire-and-forget.
  const nomination = await prisma.bestOfNomination.create({
    data: {
      businessName: parsed.data.businessName,
      businessId,
      categoryName: parsed.data.categoryName,
      nominatorName: parsed.data.nominatorName,
      nominatorEmail: parsed.data.nominatorEmail,
      reason: parsed.data.reason,
      ownerId,
      // Mirror of ownerId-set-at-submit-time. Used by the success
      // page to decide whether to show the registration-nudge CTA
      // and by GHL tagging to fire the no-account follow-up workflow.
      accountCreated: ownerId !== null,
      emailOptIn: parsed.data.emailOptIn ?? false,
      smsOptIn: false, // never collected by this form
      emailConsentAt: parsed.data.emailOptIn ? new Date() : null,
      consentSource: 'best-of-nomination-form',
      sourceIp: ip,
      userAgent: req.headers.get('user-agent'),
    },
  })

  // ── Side effects (all fire-and-forget) ──────────────────────────────────

  // 1) GHL mirror
  void syncNominatorToGHL({
    name: parsed.data.nominatorName,
    email: parsed.data.nominatorEmail,
    emailOptIn: parsed.data.emailOptIn ?? false,
    submittedAt: nomination.createdAt,
    accountCreated: nomination.accountCreated,
  })
    .then(async (res) => {
      if (res.ok && res.contactId) {
        await attachGhlContactId(nomination.id, res.contactId)
      } else if (res.skipped) {
        console.log(`[BestOfNomination] GHL skipped — ${res.reason}`)
      } else if (res.error) {
        console.error(`[BestOfNomination] GHL error — ${res.error}`)
      }
    })
    .catch((e) => console.error('[BestOfNomination] GHL sync threw:', e))

  // 2) Thank-you email to nominator
  void sendThankYouEmail({
    toName: parsed.data.nominatorName,
    toEmail: parsed.data.nominatorEmail,
    businessName: parsed.data.businessName,
    categoryName: parsed.data.categoryName,
    reason: parsed.data.reason,
  })

  // 3) Admin notification (with deep link to moderation panel)
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host') || 'www.moval.living'
  const adminLink = `${proto}://${host}/dashboard?tab=bestofnominations&nomination=${nomination.id}`
  void notifyAdminOfNomination({
    nominationId: nomination.id,
    nominatorName: parsed.data.nominatorName,
    businessName: parsed.data.businessName,
    categoryName: parsed.data.categoryName,
    adminLink,
  })

  return NextResponse.json({
    ok: true,
    nominationId: nomination.id,
    // Mirrors BestOfNomination.accountCreated — lets the success page
    // decide whether to show the "Set a password to also vote" CTA.
    // True iff the nominator had an active Owner session at submit time.
    accountCreated: nomination.accountCreated,
  })
}