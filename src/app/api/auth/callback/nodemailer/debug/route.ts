import { NextRequest, NextResponse } from 'next/server'
import { handlers } from '@/auth'

// This route intercepts the magic link callback before NextAuth processes it.
// It logs all query params so we can see exactly what's being sent.
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  console.log('[magic-link-debug] callback params:', JSON.stringify(params))
  
  // Pass through to the real handler
  return handlers.GET(req)
}

export async function POST(req: NextRequest) {
  return handlers.POST(req)
}
