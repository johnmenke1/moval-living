import { NextRequest, NextResponse } from 'next/server'
import { sendWeeklyLeadRecaps } from '@/lib/lead-recap'

/**
 * POST /api/cron/weekly-lead-recap
 *
 * Authenticated via CRON_SECRET env var. Sends each active Expert
 * Partner a weekly recap of their leads. Called by the Hermes cron
 * job (or any scheduler) — set Authorization: Bearer ${CRON_SECRET}
 * or pass ?secret=CRON_SECRET.
 *
 * Returns the recap result so the caller can log + alert on failure.
 */

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured on server' },
      { status: 500 }
    )
  }

  const auth = req.headers.get('authorization')
  const querySecret = new URL(req.url).searchParams.get('secret')
  if (auth !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendWeeklyLeadRecaps()
    return NextResponse.json({
      success: true,
      ...result,
      ranAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

// Allow GET too — easier for manual testing in a browser
export async function GET(req: NextRequest) {
  return POST(req)
}