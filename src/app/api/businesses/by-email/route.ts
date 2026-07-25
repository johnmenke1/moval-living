import { NextResponse } from 'next/server'

// Submission discovery moved behind the verified-email dashboard. This route
// remains as an explicit tombstone so older clients do not receive claim tokens.
export async function GET() {
  return NextResponse.json(
    { error: 'Sign in at /login to view and manage your listings.' },
    { status: 410 },
  )
}
