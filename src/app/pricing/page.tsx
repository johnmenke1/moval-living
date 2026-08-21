import PricingPageClient from './PricingPageClient'
import { FaqSection } from '@/components/seo/FaqSection'
import { Suspense } from 'react'

export const metadata = {
  title: 'Pricing — moval.living',
  description:
    'Upgrade your moval.listing to Featured or become a Moreno Valley Expert Partner. Real local exposure, every month.',
}

// Page is dynamic — uses searchParams for category pre-select
export const dynamic = 'force-dynamic'

const PRICING_FAQS = [
  {
    question: "What's the difference between Featured and Expert Partner?",
    answer:
      'Featured ($29/mo or $199/yr) is a directory listing upgrade — more photos, badge, homepage placement. Expert Partner ($197/mo or $997/yr) is an ongoing content partnership — monthly feature story, social promotion, newsletter placement, lead capture, and performance recap. Expert Partner also includes everything in Featured.',
  },
  {
    question: 'Why is Expert Partner priced so much higher than Featured?',
    answer:
      "Because it's actual ongoing PR work. We interview you, write a real feature story, publish it, promote it across our channels, send it to our newsletter subscribers, and give you a monthly recap. Featured is a passive upgrade; Expert Partner is an active partnership.",
  },
  {
    question: 'What\'s the "Founding Partner" rate?',
    answer:
      'The first business to claim each category locks in $197/mo or $997/yr for as long as they stay enrolled — even after we raise prices for new partners. Founding Partner is a one-time window; once all categories are claimed, the rate increases for everyone else.',
  },
  {
    question: 'What happens if my category is already claimed?',
    answer:
      "Join the waitlist from the /partners page. Waitlisted businesses get first right of refusal when a slot opens. We'll notify you by email.",
  },
  {
    question: 'Is this a paid ad?',
    answer:
      'No. Expert Partner features are clearly labeled as sponsored content — a real feature story about your business, written by our editorial team. That transparency is part of what makes it credible to readers.',
  },
  {
    question: 'What if a monthly feature story is late?',
    answer:
      'If we miss a scheduled publish date, the next month is on us — no charge. This guarantee is in writing.',
  },
  {
    question: 'Can I cancel my Featured subscription at any time?',
    answer:
      'Yes. Cancel anytime from your dashboard. Your listing remains live as a Free listing — nothing disappears, you just lose the Featured perks.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit and debit cards through Stripe. Payments are processed securely.',
  },
]

export default function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  return (
    <Suspense fallback={null}>
      <PricingSearchParamsBridge searchParams={searchParams} />
    </Suspense>
  )
}

async function PricingSearchParamsBridge({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const params = await searchParams
  return (
    <>
      <PricingPageClient initialCategory={params.category} />
      <FaqSection
        title="Pricing Questions"
        subtitle="Everything you need to know about listing on moval.living."
        faqs={PRICING_FAQS}
      />
    </>
  )
}
