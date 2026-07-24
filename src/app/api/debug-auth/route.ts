import { NextRequest, NextResponse } from 'next/server'
import { handlers } from '@/auth'

export async function GET() {
  // Call handler with explicit URL to bypass internal URL parsing
  const url = new URL('/api/auth/providers', 'https://www.moval.living')
  const req = new NextRequest(url, { method: 'GET' })
  try {
    const response = await handlers.GET(req)
    const body = await response.text()
    return NextResponse.json({ 
      status: response.status, 
      ok: response.ok,
      body: body.substring(0, 500)
    })
  } catch (e: any) {
    return NextResponse.json({ 
      caught: true, 
      error: e?.message || String(e),
      stack: e?.stack?.split('\n').slice(0, 5)
    }, { status: 500 })
  }
}
