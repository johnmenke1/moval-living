import { NextRequest, NextResponse } from 'next/server'
import { handlers } from '@/auth'

// Dedicated debug callback for magic links.
// Called by /api/auth/callback/nodemailer which routes through NextAuth.
// This lets us log exactly what params are received before NextAuth processes them.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const email = req.nextUrl.searchParams.get('email')
  const rawCallback = req.nextUrl.searchParams.get('callbackUrl') || '/dashboard'

  console.log('[magic-callback] token:', token ? `${token.slice(0, 8)}...` : 'MISSING')
  console.log('[magic-callback] email:', email)
  console.log('[magic-callback] callbackUrl (raw):', rawCallback)

  try {
    const response = await handlers.GET(req)
    console.log('[magic-callback] NextAuth response status:', response.status)
    console.log('[magic-callback] NextAuth set-cookie:', response.headers.getSetCookie())

    // If NextAuth returns a redirect, log where it's going
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      console.log('[magic-callback] redirect to:', location)
    }

    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[magic-callback] ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return handlers.POST(req)
}
