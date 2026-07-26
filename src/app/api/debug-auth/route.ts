import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    return NextResponse.json({
      ok: true,
      hasSession: !!session,
      sessionUser: session?.user
        ? { id: session.user.id, email: session.user.email, name: session.user.name, role: (session.user as { role?: string }).role }
        : null,
      secret: '***',
      secretLen: process.env.AUTH_SECRET?.length ?? 0,
      url: process.env.AUTH_URL,
      emailFrom: process.env.AUTH_EMAIL_FROM,
      smtpHost: process.env.AWS_SES_SMTP_HOST,
      nodeEnv: process.env.NODE_ENV,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
