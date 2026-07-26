import { NextRequest, NextResponse } from 'next/server'
import { handlers } from '@/auth'

// Dedicated callback route for magic links so we can debug without conflicting
// with NextAuth's internal [...nextauth] catch-all handler.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const email = req.nextUrl.searchParams.get('email')
  const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') || '/dashboard'
  const callbackUrlDecoded = decodeURIComponent(callbackUrl)

  console.log('[magic-callback] token:', token ? `${token.slice(0, 8)}...` : 'MISSING')
  console.log('[magic-callback] email:', email)
  console.log('[magic-callback] callbackUrl (raw):', callbackUrl)
  console.log('[magic-callback] callbackUrl (decoded):', callbackUrlDecoded)

  // Call the NextAuth handlers
  const response = await handlers.GET(req)
  const setCookies = response.headers.getSetCookie()
  console.log('[magic-callback] response status:', response.status)
  console.log('[magic-callback] set-cookie headers:', setCookies)

  // If the handler wants to redirect, capture it
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    console.log('[magic-callback] redirect to:', location)
    return response
  }

  return response
}
