import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { businessSlug, email } = await request.json()

    if (!businessSlug?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { slug: businessSlug.trim() },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    let owner = await prisma.owner.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!owner) {
      owner = await prisma.owner.create({
        data: { email: email.trim().toLowerCase() },
      })
    }

    await prisma.business.update({
      where: { id: business.id },
      data: { ownerId: owner.id },
    })

    return NextResponse.json({ success: true, slug: business.slug })
  } catch (error) {
    console.error('Claim error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
