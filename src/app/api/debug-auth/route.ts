import { NextResponse } from 'next/server'
import { handlers } from '@/auth'

export async function GET() {
  try {
    // Call the handler directly with a mock request to isolate the issue
    const mockUrl = new URL('/api/auth/providers', 'https://www.moval.living')
    const req = new Request(mockUrl, { method: 'GET', headers: { 'accept': 'application/json' } })
    const response = await handlers.GET(req)
    const text = await response.text()
    return NextResponse.json({ ok: true, status: response.status, body: text.substring(0, 200) })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e), stack: e?.stack }, { status: 500 })
  }
}
