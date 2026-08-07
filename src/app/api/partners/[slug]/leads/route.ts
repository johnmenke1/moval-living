import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { forwardToGHL } from '@/lib/expert-partner'

const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(50).optional().nullable(),
  message: z.string().trim().min(5).max(2000),
  // Honeypot — must be empty
  website: z.string().max(0).optional().or(z.literal('')),
})

// In-memory rate limiter (per-process). For multi-instance production
// deployment, replace with Upstash Redis or Vercel KV. Sufficient for
// MoVal.Living's traffic profile on a single Vercel deployment.
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = leadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // Honeypot check — if filled, silently 200 so bots don't retry
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ ok: true })
  }

  // Find the business — slug is the partner slug OR fallback to business slug
  const business = await prisma.business.findFirst({
    where: {
      OR: [
        { expertPartnerSlug: slug },
        { slug, isExpertPartner: true },
      ],
      status: 'APPROVED',
      isExpertPartner: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      slug: true,
      expertPartnerSlug: true,
      ghlCompanyId: true,
    },
  })

  if (!business) {
    return NextResponse.json({ error: 'Expert Partner not found' }, { status: 404 })
  }

  // Rate limit by IP
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  if (!checkRateLimit(`${ip}:${business.id}`)) {
    return NextResponse.json(
      { error: 'Too many submissions — please try again later.' },
      { status: 429 }
    )
  }

  // Save the lead locally
  const lead = await prisma.expertPartnerLead.create({
    data: {
      businessId: business.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      message: parsed.data.message,
      sourceIp: ip,
      userAgent: req.headers.get('user-agent') || null,
    },
  })

  // Forward to GHL (stubbed until env vars are set — lead still saved)
  const ghlResult = await forwardToGHL(lead, {
    businessId: business.id,
    businessName: business.name,
    expertPartnerSlug: business.expertPartnerSlug,
    cachedGhlCompanyId: business.ghlCompanyId,
  })
  if (ghlResult.ok && ghlResult.contactId) {
    await prisma.expertPartnerLead.update({
      where: { id: lead.id },
      data: {
        ghlContactId: ghlResult.contactId,
        ghlSyncedAt: new Date(),
      },
    })
    // Cache the companyId on the Business row so future leads skip the
    // upsert. forwardToGHL already returns it; we just persist it.
    if (ghlResult.companyId && !business.ghlCompanyId) {
      await prisma.business.update({
        where: { id: business.id },
        data: { ghlCompanyId: ghlResult.companyId },
      })
      console.log(
        `[Partner Lead] Cached ghlCompanyId ${ghlResult.companyId} for ${business.name}`
      )
    }
  } else if (ghlResult.skipped) {
    console.log(`[Partner Lead] ${business.name}: GHL skipped — ${ghlResult.reason}`)
  } else if (ghlResult.error) {
    console.error(`[Partner Lead] ${business.name}: GHL error — ${ghlResult.error}`)
  }

  // Notify the partner via SES (fire-and-forget — don't fail the response)
  const businessEmail = business.email
  if (businessEmail) {
    notifyPartner(business.name, businessEmail, parsed.data).catch((e) => {
      console.error('[Partner Lead] SES notify failed:', e)
    })
  } else {
    console.log(
      `[Partner Lead] ${business.name} has no email on file — lead ${lead.id} saved but not emailed.`
    )
  }

  return NextResponse.json({ ok: true, leadId: lead.id })
}

async function notifyPartner(
  businessName: string,
  businessEmail: string,
  payload: { name: string; email: string; phone?: string | null; message: string }
): Promise<void> {
  const sesHost = process.env.AWS_SES_SMTP_HOST
  const sesUser = process.env.AWS_SES_SMTP_USERNAME
  const sesPass = process.env.AWS_SES_SMTP_PASSWORD
  const from = process.env.AUTH_EMAIL_FROM || 'noreply@send.moval.living'

  if (!sesHost || !sesUser || !sesPass) {
    console.log('[Partner Lead] SES env vars missing — skipping email notification')
    return
  }

  // Lazy-load nodemailer to avoid pulling it in for builds that never email
  const nodemailer = await import('nodemailer').catch(() => null)
  if (!nodemailer) {
    console.log('[Partner Lead] nodemailer not installed — skipping email')
    return
  }

  const transporter = nodemailer.createTransport({
    host: sesHost,
    port: 587,
    secure: false,
    auth: { user: sesUser, pass: sesPass },
  })

  const subject = `New Expert Partner lead — ${payload.name}`
  const text = [
    `You have a new lead via your moval.living Expert Partner page.`,
    ``,
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    ``,
    `Message:`,
    payload.message,
    ``,
    `— Reply directly to this email to reach ${payload.name}.`,
  ]
    .filter(Boolean)
    .join('\n')

  await transporter.sendMail({
    from: `movalliving Expert Partner <${from}>`,
    to: businessEmail,
    replyTo: payload.email,
    subject,
    text,
  })
}