import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { signIn } from '@/auth'

// POST /api/auth/register — create owner account + sign in (used by claim flow)
//
// Accepts opt-in checkboxes for CAN-SPAM / 10DLC / TCPA compliance:
//   emailOptIn: explicit consent for marketing emails
//   smsOptIn:   explicit consent for SMS (currently unused, reserved for future)
//
// Also accepts claim-flow specifics when invoked from /claim:
//   claimToken:       the unconsumed claim token (verified server-side)
//   seHablaEspanol:   boolean — written to the Business so the "Se Habla
//                     Español" badge can render on the listing card
//
// Both default to false. We record the consent timestamp so we have an
// audit trail for 10DLC registration and CCPA inquiries.
export async function POST(req: NextRequest) {
  const {
    email,
    password,
    name,
    phone,
    emailOptIn = false,
    smsOptIn = false,
    claimToken,
    seHablaEspanol = false,
  } = await req.json()

  if (!email || !password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Validate phone if SMS opt-in is requested
  if (smsOptIn && (!phone || !/^\+?[\d\s\-()]{10,}$/.test(phone))) {
    return NextResponse.json(
      { error: 'A valid phone number is required for SMS opt-in' },
      { status: 400 }
    )
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Check if owner already exists
  const existing = await prisma.owner.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const now = new Date()

  // If a claim token was provided, verify it is still consumable before we
  // do any writes — fail fast so the user gets the same error path they'd
  // see at /api/claim/verify (invalid / expired / already claimed).
  let claimBusinessId: string | null = null
  if (claimToken) {
    const claimable = await prisma.business.findUnique({
      where: { claimToken },
      select: { id: true, ownerId: true, claimExpiresAt: true },
    })
    if (!claimable) {
      return NextResponse.json({ error: 'Invalid claim link' }, { status: 404 })
    }
    if (claimable.ownerId) {
      return NextResponse.json({ error: 'This listing has already been claimed' }, { status: 410 })
    }
    if (claimable.claimExpiresAt && claimable.claimExpiresAt.getTime() <= now.getTime()) {
      return NextResponse.json({ error: 'This claim link has expired' }, { status: 410 })
    }
    claimBusinessId = claimable.id
  }

  // Create the owner with consent tracking
  const owner = await prisma.owner.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || null,
      passwordHash,
      emailVerified: now,
      phone: phone?.trim() || null,
      emailOptIn: Boolean(emailOptIn),
      smsOptIn: Boolean(smsOptIn),
      emailConsentAt: emailOptIn ? now : null,
      smsConsentAt: smsOptIn ? now : null,
      smsConsentSource: smsOptIn ? 'claim-form' : null,
    },
  })

  // Persist the "Se Habla Español" flag onto the Business so the public
  // listing card renders the badge. Done here (not at /claim/complete)
  // because by the time the complete page runs the form's checkbox state
  // is gone — only the token survives the redirect.
  if (claimBusinessId) {
    await prisma.business.update({
      where: { id: claimBusinessId },
      data: { seHablaEspanol: Boolean(seHablaEspanol) },
    })
  }

  // Sign in immediately so the session is established
  try {
    const result = await signIn('credentials', {
      email: normalizedEmail,
      password,
      redirect: false,
    })

    if (result?.error) {
      return NextResponse.json({ error: 'Account created but sign-in failed. Please log in manually.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      ownerId: owner.id,
      emailOptIn: owner.emailOptIn,
      smsOptIn: owner.smsOptIn,
    })
  } catch (err) {
    console.error('[register] signIn error:', err)
    return NextResponse.json({ error: 'Account created. Please log in manually.' }, { status: 500 })
  }
}