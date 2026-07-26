import { NextResponse } from 'next/server'
import { auth } from '@/auth'

// Diagnostic: call auth() directly to see what secret/URL it sees
export async function GET() {
  try {
    const session = await auth()
    return NextResponse.json({
      ok: true,
      hasSession: !!session,
      sessionUser: session?.user ? { id: session.user.id, email: session.user.email, role: (session.user as { role?: string }).role } : null,
      secret: '***', // don't leak
      secretLen: process.env.AUTH_SECRET?.length ?? 0,
      url: process.env.AUTH_URL ?? 'MISSING',
      emailFrom: process.env.AUTH_EMAIL_FROM ?? 'MISSING',
      smtpHost: process.env.AWS_SES_SMTP_HOST ?? 'MISSING',
      smtpUser: process.env.AWS_SES_SMTP_USERNAME ?? 'MISSING',
      authEmailFrom: process.env.AUTH_EMAIL_FROM ?? 'MISSING',
      nodeEnv: process.env.NODE_ENV ?? 'MISSING',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
