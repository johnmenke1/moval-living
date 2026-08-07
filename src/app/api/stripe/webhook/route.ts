import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import type { Tier } from '@prisma/client'

/**
 * Stripe webhook handler — supports both Featured and Expert Partner tiers.
 *
 * The checkout route embeds `tier` ('featured' | 'expert') in both the
 * session metadata AND the subscription metadata. We use that to decide
 * which tier to set on the Business row. This means we DON'T need a
 * per-tier product/price lookup table.
 *
 * On cancel/revoke, the tier reverts to FREE — Expert Partner is special:
 * we also flip `isExpertPartner = false` so the badge disappears from the
 * listing until Johnny manually re-enrolls the business.
 */

const EXPERT_PRICE_IDS = new Set([
  process.env.STRIPE_PRICE_EXPERT_MONTHLY,
  process.env.STRIPE_PRICE_EXPERT_YEARLY,
].filter(Boolean))

function resolveTierFromMetadata(tier: string | undefined): Tier {
  return tier === 'expert' ? 'EXPERT_PARTNER' : 'FEATURED'
}

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
        const tierMeta = session.metadata?.tier
        if (!businessId) break

        const subscription = await getStripe().subscriptions.retrieve(
          session.subscription as string,
          { expand: ['items.data.price'] }
        )
        const sub = subscription as unknown as Record<string, unknown>

        const newTier = resolveTierFromMetadata(tierMeta)
        const isExpert = newTier === 'EXPERT_PARTNER'

        await prisma.business.update({
          where: { id: businessId },
          data: {
            tier: newTier,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: sub.id as string,
            subscriptionStatus: sub.status as string,
            subscriptionCurrentPeriodEnd: new Date((sub.billing_period_end as number) * 1000),
            // Expert Partner upgrades auto-flag the partner; founding date
            // is set later by Johnny when he confirms Founding Partner status.
            ...(isExpert ? { isExpertPartner: true } : {}),
          },
        })
        console.log(
          `[Stripe] Business ${businessId} upgraded to ${newTier} via checkout.session.completed`
        )
        break
      }

      case 'customer.subscription.updated': {
        const subRaw = event.data.object as Stripe.Subscription
        const businessId = subRaw.metadata?.businessId
        const tierMeta = subRaw.metadata?.tier
        if (!businessId) break

        const isActive = ['active', 'trialing'].includes(subRaw.status)
        const tier = isActive ? resolveTierFromMetadata(tierMeta) : 'FREE' as Tier
        const isExpert = tier === 'EXPERT_PARTNER'
        // Stripe.Subscription doesn't expose billing_period_end as a typed
        // property in current @stripe/stripe-js typings; cast for the cast.
        const periodEnd = (subRaw as unknown as { billing_period_end?: number }).billing_period_end

        await prisma.business.update({
          where: { id: businessId },
          data: {
            tier,
            subscriptionStatus: subRaw.status,
            subscriptionCurrentPeriodEnd: periodEnd
              ? new Date(periodEnd * 1000)
              : null,
            ...(isExpert ? { isExpertPartner: true } : { isExpertPartner: false }),
          },
        })
        console.log(
          `[Stripe] Business ${businessId} subscription updated to ${subRaw.status} → tier=${tier}`
        )
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const businessId = sub.metadata?.businessId
        const tierMeta = sub.metadata?.tier
        if (!businessId) break

        const wasExpert = tierMeta === 'expert'

        await prisma.business.update({
          where: { id: businessId },
          data: {
            tier: 'FREE',
            subscriptionStatus: 'canceled',
            stripeSubscriptionId: null,
            // If they were Expert Partner, drop the flag too so the badge
            // disappears. Johnny can manually re-enable for grace periods.
            ...(wasExpert ? { isExpertPartner: false } : {}),
          },
        })
        console.log(
          `[Stripe] Business ${businessId} subscription canceled — reverted to FREE` +
            (wasExpert ? ' (Expert Partner flag cleared)' : '')
        )
        break
      }
    }
  } catch (err) {
    console.error('[Stripe Webhook] DB update failed:', err)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}