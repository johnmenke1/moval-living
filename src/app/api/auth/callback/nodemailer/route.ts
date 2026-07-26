import { NextRequest, NextResponse } from 'next/server'
import { handlers } from '@/auth'

// Dedicated callback route for magic links - wraps NextAuth handlers
// to capture error details that NextAuth swallows and redirects.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const email = req.nextUrl.searchParams.get('email')
  const callbackUrl = req.nextUrl.searchParams.get('callbackUrl')

  console.log('[nodemailer-callback] token:', token ? `${token.slice(0, 8)}...` : 'MISSING')
  console.log('[nodemailer-callback] email:', email)
  console.log('[nodemailer-callback] callbackUrl:', callbackUrl)
  console.log('[nodemailer-callback] AUTH_SECRET set:', !!process.env.AUTH_SECRET, 'len:', process.env.AUTH_SECRET?.length)
  console.log('[nodemailer-callback] AUTH_URL:', process.env.AUTH_URL)

  try {
    const response = await handlers.GET(req)
    const setCookies = response.headers.getSetCookie()
    console.log('[nodemailer-callback] NextAuth status:', response.status)
    console.log('[nodemailer-callback] set-cookie count:', setCookies.length)
    if (setCookies.length > 0) console.log('[nodemailer-callback] cookies:', setCookies.map(c => c.slice(0, 50)))

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      console.log('[nodemailer-callback] redirect to:', location)
    }

    // If it's a redirect to login page with error, capture the error param
    const redirectUrl = response.headers.get('location') || ''
    if (redirectUrl.includes('login?error=')) {
      const errorParam = new URL(redirectUrl, 'http://x').searchParams.get('error')
      console.error('[nodemailer-callback] AUTH ERROR:', errorParam)
    }

    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const cause = error instanceof Error && error.cause ? JSON.stringify(error.cause) : undefined
    console.error('[nodemailer-callback] EXCEPTION:', message, 'cause:', cause)
    return NextResponse.json({ error: message, cause }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return handlers.POST(req)
}
