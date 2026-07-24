import { NextRequest, NextResponse } from 'next/server'
import { handlers } from '@/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.pathname
  if (url.includes('/callback/')) {
    console.log('[AUTH callback GET]', url, Object.fromEntries(req.nextUrl.searchParams))
  }
  try {
    return await handlers.GET(req)
  } catch (e: any) {
    console.error('[AUTH GET error]', e?.message || e, e?.cause ? JSON.stringify(e.cause) : '')
    return NextResponse.json({ error: e?.message || String(e), cause: e?.cause ? String(e.cause) : '' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handlers.POST(req)
  } catch (e: any) {
    console.error('[AUTH POST error]', e?.message || e, e?.cause ? JSON.stringify(e.cause) : '')
    return NextResponse.json({ error: e?.message || String(e), cause: e?.cause ? String(e.cause) : '' }, { status: 500 })
  }
}
