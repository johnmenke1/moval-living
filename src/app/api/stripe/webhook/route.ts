import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Stripe Webhook] Signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const businessId = session.metadata?.businessId
        if (!businessId) break

        const subscription = await getStripe().subscriptions.retrieve(
          session.subscription as string,
          { expand: ['items.data.price'] }
        )
        const sub = subscription as unknown as Record<string, unknown>

        await prisma.business.update({
          where: { id: businessId },
          data: {
            tier: 'FEATURED',
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: sub.id as string,
            subscriptionStatus: sub.status as string,
            subscriptionCurrentPeriodEnd: new Date((sub.billing_period_end as number) * 1000),
          },
        })
        console.log(`[Stripe] Business ${businessId} upgraded to FEATURED via checkout.session.completed`)
        break
      }

      case 'customer.subscription.updated': {
        const subRaw = event.data.object as Stripe.Subscription
        const sub = subRaw as unknown as Record<string, unknown>
        const businessId = subRaw.metadata?.businessId
        if (!businessId) break

        const isActive = ['active', 'trialing'].includes(subRaw.status)
        await prisma.business.update({
          where: { id: businessId },
          data: {
            tier: isActive ? 'FEATURED' : 'FREE',
            subscriptionStatus: subRaw.status,
            subscriptionCurrentPeriodEnd: new Date((sub.billing_period_end as number) * 1000),
          },
        })
        console.log(`[Stripe] Business ${businessId} subscription updated to ${subRaw.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const businessId = sub.metadata?.businessId
        if (!businessId) break

        await prisma.business.update({
          where: { id: businessId },
          data: {
            tier: 'FREE',
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: null,
          },
        })
        console.log(`[Stripe] Business ${businessId} subscription canceled — reverted to FREE`)
        break
      }
    }
  } catch (err) {
    console.error('[Stripe Webhook] DB update failed:', err)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
