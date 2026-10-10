import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { and, eq, gt, isNotNull } from 'drizzle-orm'
import { db, owner } from '@/db'

const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { token, password } = body as { token?: unknown; password?: unknown }

  if (typeof token !== 'string' || !token || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json(
      { error: 'A valid reset link and password (at least 8 characters) are required' },
      { status: 400 },
    )
  }

  // We can't look up the owner by token alone because the stored value is a
  // bcrypt hash. We need to scan owners with a non-null resetToken, then
  // bcrypt.compare against each. The token space is large enough that this
  // O(n) scan is fine for an admin-scale user list.
  const candidates = await db.query.owner.findMany({
    where: and(isNotNull(owner.resetToken), gt(owner.resetExpires, new Date())),
    columns: { id: true, resetToken: true, resetExpires: true },
  })

  let matchedId: string | null = null
  for (const candidate of candidates) {
    if (!candidate.resetToken || !candidate.resetExpires) continue
    if (candidate.resetExpires.getTime() < Date.now()) continue
    // bcrypt.compare is constant-time per comparison; the loop bound is
    // small (admin users, not a public form).
    if (await bcrypt.compare(token, candidate.resetToken)) {
      matchedId = candidate.id
      break
    }
  }

  if (!matchedId) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired' },
      { status: 400 },
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // One-shot: clear the reset fields and write the new hash atomically so a
  // second confirm attempt with the same token cannot succeed.
  await db
    .update(owner)
    .set({ passwordHash, resetToken: null, resetExpires: null })
    .where(eq(owner.id, matchedId))

  return NextResponse.json({ ok: true })
}