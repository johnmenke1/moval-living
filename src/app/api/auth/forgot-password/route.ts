import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendForgotPasswordEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true }) // never leak validation errors
  }
  const email = typeof (body as { email?: unknown }).email === 'string'
    ? (body as { email: string }).email.toLowerCase().trim()
    : ''

  if (!email) {
    return NextResponse.json({ ok: true })
  }

  const owner = await prisma.owner.findUnique({
    where: { email },
    select: { id: true },
  })

  // Always return success to prevent email enumeration. Only generate a
  // reset token if we have an owner — otherwise we'd be writing to the DB
  // for non-existent emails.
  if (!owner) {
    return NextResponse.json({ ok: true })
  }

  // Cryptographically secure random token. We store a bcrypt hash of the
  // token so that a DB leak doesn't expose valid reset links.
  const rawToken = randomBytes(32).toString('hex')
  const bcrypt = await import('bcryptjs')
  const hashedToken = await bcrypt.hash(rawToken, 10)
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.owner.update({
    where: { email },
    data: { resetToken: hashedToken, resetExpires },
  })

  // Token-only URL — we don't put the email in the query string because
  // it gets logged in access logs and browser history. The bcrypt.compare
  // on the server side already scopes the lookup to the right row via
  // the (rare-collision) hash, and we'll match by token at confirm time.
  const resetUrl = `${process.env.AUTH_URL || 'https://www.moval.living'}/reset-password?token=${rawToken}`

  try {
    await sendForgotPasswordEmail(email, resetUrl)
  } catch (err) {
    // Don't surface send failures to the client (still return ok:true)
    // so we don't leak whether the email was actually delivered.
    console.error('[forgot-password] email send failed', err)
  }

  return NextResponse.json({ ok: true })
}