import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

// Debug callback - intercepts magic link clicks so we can log exactly what's happening
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const email = req.nextUrl.searchParams.get('email')
  const callbackUrl = req.nextUrl.searchParams.get('callbackUrl')

  const debug = {
    receivedToken: token ? `${token.slice(0, 8)}...` : null,
    receivedEmail: email,
    receivedCallbackUrl: callbackUrl,
    authUrl: process.env.AUTH_URL,
    authSecretSet: !!process.env.AUTH_SECRET,
    authSecretLen: process.env.AUTH_SECRET?.length ?? 0,
    nodeEnv: process.env.NODE_ENV,
  }

  console.log('[auth-callback-debug] params:', JSON.stringify(debug))

  // Try to call auth() to see if it works
  try {
    const session = await auth()
    console.log('[auth-callback-debug] auth() session:', session ? 'exists' : 'null')
    debug.sessionFromAuth = session ? { user: session.user?.email, expires: session.expires } : null
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[auth-callback-debug] auth() error:', msg)
    debug.authError = msg
  }

  return NextResponse.json(debug)
}
