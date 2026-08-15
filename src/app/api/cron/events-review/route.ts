/**
 * GET /api/cron/events-review
 *
 * Vercel Cron endpoint — runs daily, fires at 7:30am Pacific (14:30 UTC).
 * See vercel.json for the schedule definition.
 *
 * Purpose: nudge Johnny and Emma about pending Event Submissions so they
 * do the daily review together. Reads the count of PENDING submissions,
 * composes a one-line Slack message, and posts it to the #emma1 channel.
 *
 * Auth: requires `x-cron-secret` header to match process.env.CRON_SECRET.
 * Vercel Cron automatically sends this header (configured in the
 * dashboard or via the CRON_SECRET env var).
 *
 * Message format:
 *   - 0 pending → "No new submissions today. I love you."
 *   - N pending → "Johnny, there are N cards for you to review today. I love you."
 *
 * Slack delivery: posts to process.env.SLACK_WEBHOOK_URL or the channel
 * ID stored in process.env.SLACK_CHANNEL_EMMA1. We use the webhook URL
 * approach (simpler) — the webhook is configured to post to #emma1 in the
 * Slack admin panel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  // Auth: x-cron-secret header must match env
  const provided = req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET not configured' },
      { status: 500 }
    )
  }
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Count pending submissions
  const pendingCount = await prisma.submission.count({
    where: { status: 'PENDING' },
  })

  // Compose message
  const message =
    pendingCount === 0
      ? 'No new submissions today. I love you.'
      : pendingCount === 1
        ? 'Johnny, there is 1 card for you to review today. I love you.'
        : `Johnny, there are ${pendingCount} cards for you to review today. I love you.`

  // Deliver to Slack via incoming webhook
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: 'SLACK_WEBHOOK_URL not configured',
        message,
        pendingCount,
      },
      { status: 500 }
    )
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json(
        {
          ok: false,
          error: `Slack webhook returned ${res.status}`,
          slackBody: body.slice(0, 500),
          pendingCount,
        },
        { status: 502 }
      )
    }
    return NextResponse.json({ ok: true, pendingCount, delivered: true })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Slack delivery failed',
        pendingCount,
      },
      { status: 500 }
    )
  }
}
