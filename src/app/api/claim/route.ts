import { NextResponse } from 'next/server'

// Claiming is handled exclusively by the signed token + verified magic-link
// flow at /claim. The legacy slug/email endpoint let callers assign ownership
// without possessing a claim token, so it is intentionally disabled.
export async function POST() {
  return NextResponse.json(
    { error: 'Use the secure claim link sent with the business submission.' },
    { status: 410 },
  )
}
