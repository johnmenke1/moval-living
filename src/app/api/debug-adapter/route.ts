import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test 1: Direct Prisma call
    const testToken = await prisma.verificationToken.create({
      data: {
        identifier: 'debug@test.com',
        token: 'test-token-' + Date.now(),
        expires: new Date(Date.now() + 3600000),
      },
    })

    // Test 2: Look up the adapter's createVerificationToken
    const { PrismaAdapter } = await import('@auth/prisma-adapter')
    const { Pool } = await import('pg')
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const { PrismaClient } = await import('@prisma/client')

    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma2 = new PrismaClient({ adapter })
    const adapterInstance = PrismaAdapter(prisma2)

    const token2 = await adapterInstance.createVerificationToken({
      identifier: 'adapter@test.com',
      token: 'adapter-token-' + Date.now(),
      expires: new Date(Date.now() + 3600000),
    })

    return NextResponse.json({
      direct_prisma: 'OK',
      adapter: token2 ? 'OK' : 'FAILED',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e), stack: e?.stack ? e.stack.split('\n').slice(0,3) : '' }, { status: 500 })
  }
}
