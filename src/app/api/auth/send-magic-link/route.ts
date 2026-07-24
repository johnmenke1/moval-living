import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createHash, randomBytes } from 'crypto'
import nodemailer from 'nodemailer'

function generateToken() {
  return randomBytes(32).toString('hex')
}

function hashToken(token: string, secret: string) {
  return createHash('sha256').update(`${token}${secret}`).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { email, callbackUrl } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const token = generateToken()
    const secret = process.env.AUTH_SECRET || 'fallback-secret'
    const hashedToken = hashToken(token, secret)
    const expires = new Date(Date.now() + 3600000) // 1 hour

    // Store token in DB
    await prisma.verificationToken.create({
      data: { identifier: email, token: hashedToken, expires },
    })

    // Build magic link
    const magicUrl = new URL(`${process.env.AUTH_URL || 'https://www.moval.living'}/api/auth/callback/nodemailer`)
    magicUrl.searchParams.set('token', token)
    magicUrl.searchParams.set('email', email)
    if (callbackUrl) {
      magicUrl.searchParams.set('callbackUrl', callbackUrl)
    }

    // Send email via SES
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
      subject: 'Your Sign-In Link',
      text: `Click here to sign in: ${magicUrl.toString()}\n\nIf you didn't request this, ignore this email.`,
    })

    return NextResponse.json({ ok: true, message: 'Email sent' })
  } catch (e: any) {
    console.error('[send-magic-link]', e?.message || e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
