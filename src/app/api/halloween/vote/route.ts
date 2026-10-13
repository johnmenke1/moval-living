import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, or } from 'drizzle-orm'
import { db, halloweenEntry, halloweenVote } from '@/db'
import { verifyTurnstileOrSkip } from '@/lib/turnstile'
import {
  DEVICE_COOKIE,
  clientIp,
  getContestState,
  hashIp,
  mintDeviceCookie,
  readDeviceCookie,
} from '@/lib/halloween'
import { countVotes } from '@/lib/halloween-queries'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  entryId: z.string().min(1).max(64),
  turnstileToken: z.string().optional(),
})

/**
 * One vote per home per device AND per network (both unique-indexed in the DB,
 * so concurrent requests cannot double-count). A browser that already holds a
 * valid signed device cookie skips the CAPTCHA; a new one must pass Turnstile.
 */
export async function POST(req: NextRequest) {
  if (!getContestState().votingOpen) {
    return NextResponse.json({ error: 'Voting is not open right now.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { entryId, turnstileToken } = parsed.data

  const ip = clientIp(req.headers)
  // Without any network signal we can't enforce one-vote-per-network; refuse.
  if (ip === 'unknown') return NextResponse.json({ error: 'Could not verify your connection.' }, { status: 400 })

  let deviceId = await readDeviceCookie(req.cookies.get(DEVICE_COOKIE)?.value)
  let newCookie: string | null = null
  if (!deviceId) {
    const t = await verifyTurnstileOrSkip(turnstileToken ?? '', ip)
    if (!t.ok) {
      return NextResponse.json({ error: 'Please complete the verification and try again.', needsCaptcha: true }, { status: 403 })
    }
    const minted = await mintDeviceCookie()
    deviceId = minted.id
    newCookie = minted.value
  }
  const ipHash = await hashIp(ip)

  const entry = await db.query.halloweenEntry.findFirst({
    where: and(eq(halloweenEntry.id, entryId), eq(halloweenEntry.status, 'APPROVED')),
    columns: { id: true },
  })
  if (!entry) return NextResponse.json({ error: 'Home not found.' }, { status: 404 })

  const prior = await db.query.halloweenVote.findFirst({
    where: and(eq(halloweenVote.entryId, entryId), or(eq(halloweenVote.deviceId, deviceId), eq(halloweenVote.ipHash, ipHash))),
    columns: { id: true },
  })

  let counted = false
  if (!prior) {
    const inserted = await db
      .insert(halloweenVote)
      .values({ entryId, ipHash, deviceId })
      .onConflictDoNothing()
      .returning({ id: halloweenVote.id })
    counted = inserted.length > 0
  }

  const votes = await countVotes(entryId)
  const res = NextResponse.json(
    counted ? { ok: true, votes } : { ok: false, alreadyVoted: true, votes, error: 'You already voted for this home.' },
    { status: counted ? 200 : 409 },
  )
  if (newCookie) {
    res.cookies.set(DEVICE_COOKIE, newCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 60,
    })
  }
  return res
}
