import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { signIn } from '@/auth'

// POST /api/auth/register — create owner account + sign in (used by claim flow)
export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json()

  if (!email || !password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Check if owner already exists
  const existing = await prisma.owner.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Create the owner
  const owner = await prisma.owner.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || null,
      passwordHash,
      emailVerified: new Date(),
    },
  })

  // Sign in immediately so the session is established
  try {
    const result = await signIn('credentials', {
      email: normalizedEmail,
      password,
      redirect: false,
    })

    if (result?.error) {
      return NextResponse.json({ error: 'Account created but sign-in failed. Please log in manually.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ownerId: owner.id })
  } catch (err) {
    console.error('[register] signIn error:', err)
    return NextResponse.json({ error: 'Account created. Please log in manually.' }, { status: 500 })
  }
}
