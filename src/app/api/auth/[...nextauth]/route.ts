import { NextRequest, NextResponse } from 'next/server'
import { handlers } from '@/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    return await handlers.GET(req)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[AUTH GET error]', message)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handlers.POST(req)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[AUTH POST error]', message)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
