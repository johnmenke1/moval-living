import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    include: { business: true },
  })

  if (!owner?.business?.stripeCustomerId) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moval.living'

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: owner.business.stripeCustomerId,
    return_url: `${appUrl}/dashboard`,
  })

  return NextResponse.json({ url: portalSession.url })
}
