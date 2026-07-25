import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import nodemailer from 'nodemailer'
import { hashMagicLinkToken, safeCallbackPath } from '@/lib/magic-link'

function generateToken() {
  return randomBytes(32).toString('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail, callbackUrl } = await req.json()
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const secret = process.env.AUTH_SECRET
    if (!secret) {
      console.error('[send-magic-link] AUTH_SECRET is not configured')
      return NextResponse.json({ error: 'Sign-in is temporarily unavailable' }, { status: 503 })
    }

    const token = generateToken()
    const hashedToken = hashMagicLinkToken(token, secret)
    const expires = new Date(Date.now() + 3600000)

    await prisma.verificationToken.create({
      data: { identifier: email, token: hashedToken, expires },
    })

    const magicUrl = new URL(`${process.env.AUTH_URL || 'https://www.moval.living'}/api/auth/callback/nodemailer`)
    magicUrl.searchParams.set('token', token)
    magicUrl.searchParams.set('email', email)
    magicUrl.searchParams.set('callbackUrl', safeCallbackPath(callbackUrl))

    const transporter = nodemailer.createTransport({
      host: process.env.AWS_SES_SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.AWS_SES_SMTP_USERNAME,
        pass: process.env.AWS_SES_SMTP_PASSWORD,
      },
    })

    await transporter.sendMail({
      from: process.env.AUTH_EMAIL_FROM || 'noreply@moval.living',
      to: email,
      subject: 'Your moval.living sign-in link',
      text: `Click here to sign in: ${magicUrl.toString()}\n\nIf you didn't request this, ignore this email.`,
    })

    return NextResponse.json({ ok: true, message: 'Email sent' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[send-magic-link]', message)
    return NextResponse.json({ error: 'Unable to send sign-in link' }, { status: 500 })
  }
}
