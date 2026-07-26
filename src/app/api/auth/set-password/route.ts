import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

// POST /api/auth/set-password — set a password for the currently logged-in owner
export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { password } = await req.json()

  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  await prisma.owner.update({
    where: { id: session.user.id },
    data: { passwordHash, emailVerified: new Date() },
  })

  return NextResponse.json({ ok: true })
}
