import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET() {
  try {
    const session = await auth()
    return NextResponse.json({ 
      ok: true, 
      session: session ? 'has session' : 'no session',
      secret: process.env.AUTH_SECRET ? 'SET (' + process.env.AUTH_SECRET.length + ')' : 'MISSING',
      url: process.env.AUTH_URL || 'MISSING'
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
