import { NextRequest, NextResponse } from 'next/server'
import { handlers } from '@/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Add debugging for the callback path
  const url = req.nextUrl.pathname
  if (url.includes('/callback/')) {
    console.log('[AUTH] Callback request:', url, Object.fromEntries(req.nextUrl.searchParams))
  }
  try {
    return await handlers.GET(req)
  } catch (e: any) {
    console.error('[AUTH] Handler error:', e?.message || e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handlers.POST(req)
  } catch (e: any) {
    console.error('[AUTH] Handler POST error:', e?.message || e)
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
