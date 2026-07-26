import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/send-magic-link — send a magic link for the claim flow
// This endpoint is used by the claim flow to verify email ownership.
// The actual sign-in happens when the user clicks the link and NextAuth
// processes the token + creates a session.
export async function POST(req: NextRequest) {
  const { email, callbackUrl } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Look up the owner by email — they must already exist
  const owner = await prisma.owner.findUnique({ where: { email: normalizedEmail } })
  if (!owner) {
    // Don't reveal whether the owner exists
    return NextResponse.json({ ok: true })
  }

  // Use NextAuth's signIn to send the magic link
  const { signIn } = await import('@/auth')
  try {
    await signIn('nodemailer', {
      email: normalizedEmail,
      callbackUrl: callbackUrl || '/claim/complete',
      redirect: false,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[send-magic-link] error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
