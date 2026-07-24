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
      from: process.env.AUTH_EMAIL_FROM || 'noreply@example.com',
      to: 'john@menke.re',
      subject: 'Test Email from Moval',
      text: 'This is a test email from the Moval SMTP test endpoint.',
    })

    return NextResponse.json({ ok: true, message: 'Email sent' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
