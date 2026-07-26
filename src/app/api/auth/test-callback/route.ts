import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const email = req.nextUrl.searchParams.get('email')

  if (!token || !email) {
    return NextResponse.json({ error: 'token and email required' }, { status: 400 })
  }

  try {
    // Step 1: call auth() to get the session/user after callback
    const session = await auth()
    return NextResponse.json({
      step: 'post-callback session check',
      session: session ? { user: session.user, expires: session.expires } : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const cause = err instanceof Error && err.cause ? String(err.cause) : undefined
    return NextResponse.json({ step: 'post-callback auth() failed', error: message, cause }, { status: 500 })
  }
}
