import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET() {
  try {
    // Call auth() directly - same as used in middleware
    const session = await auth()
    return NextResponse.json({ ok: true, session: session ? 'has session' : 'no session' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e), stack: e?.stack }, { status: 500 })
  }
}
