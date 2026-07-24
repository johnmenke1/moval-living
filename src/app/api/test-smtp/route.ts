import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function GET() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.AWS_SES_SMTP_HOST || 'smtp://localhost',
      port: 587,
      secure: false,
      auth: {
        user: process.env.AWS_SES_SMTP_USERNAME,
        pass: process.env.AWS_SES_SMTP_PASSWORD,
      },
    })

    await transporter.sendMail({
      from: 'noreply@moval.living',
      to: 'john@menke.re',
      subject: 'Test Email - AUTH_EMAIL_FROM check',
      text: 'Testing if this arrives.',
    })

    return NextResponse.json({ ok: true, message: 'Sent from noreply@moval.living' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e), host: process.env.AWS_SES_SMTP_HOST, user: process.env.AWS_SES_SMTP_USERNAME ? 'SET' : 'MISSING' }, { status: 500 })
  }
}
