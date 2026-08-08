'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  X,
  Star,
  Sparkles,
  Calendar,
  Mail,
  Megaphone,
  BarChart3,
  Users,
} from 'lucide-react'
import { clsx } from 'clsx'
import { FaqSection } from '@/components/seo/FaqSection'

const featuredFeatures = [
  { label: 'Basic listing', free: true, featured: true },
  { label: 'Contact info & map', free: true, featured: true },
  { label: 'Up to 3 photos', free: true, featured: true },
  { label: 'Reviews & ratings', free: true, featured: true },
  { label: 'Featured badge on listing', free: false, featured: true },
  { label: 'Homepage featured section', free: false, featured: true },
  { label: 'Priority search ranking', free: false, featured: true },
  { label: 'Up to 10 photos', free: false, featured: true },
  { label: 'Coupons & deals', free: false, featured: true },
]

interface PricingPageClientProps {
  initialCategory?: string
}

export default function PricingPageClient({ initialCategory }: PricingPageClientProps = {}) {
  const { data: session } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState<'featured-monthly' | 'featured-yearly' | 'expert-monthly' | 'expert-yearly' | null>(null)

  const handleUpgrade = async (
    tier: 'featured' | 'expert',
    interval: 'monthly' | 'yearly'
  ) => {
    if (!session) {
      router.push('/login?callbackUrl=/pricing')
      return
    }
    const key = `${tier}-${interval}` as
      | 'featured-monthly'
      | 'featured-yearly'
      | 'expert-monthly'
      | 'expert-yearly'
    setLoading(key)
    try {
      const res = await fetch(`/api/stripe/checkout?interval=${interval}&tier=${tier}`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error || `Checkout failed (${res.status})`)
      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error('No checkout URL returned')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-[#f0efeb] min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#007a7f] to-[#00405c] text-white py-20">
        <div className="container-max text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-white/85 text-lg max-w-xl mx-auto">
            Start free. Upgrade to Featured when you&apos;re ready. Go Expert Partner when
            you want a real ongoing local PR engine.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container-max py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Free */}
          <div className="bg-white rounded-2xl border border-slate-200 p-7">
            <h2 className="text-2xl font-bold text-[#1a2e35] mb-2">Free</h2>
            <p className="text-[#5a6c72] mb-6 text-sm">
              Everything you need to get listed and found.
            </p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-[#1a2e35]">$0</span>
              <span className="text-[#5a6c72]">/month</span>
            </div>
            <Link
              href="/submit"
              className="block w-full py-3 px-6 text-center rounded-lg border-2 border-slate-200 text-[#1a2e35] font-semibold hover:border-[#007a7f] hover:text-[#007a7f] transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* Featured */}
          <div className="bg-white rounded-2xl border-2 border-[#007a7f] p-7 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-[#007a7f] text-white text-sm font-bold px-4 py-1 rounded-full">
                Most Popular
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#1a2e35] mb-2 flex items-center gap-2">
              <Star className="w-6 h-6 text-[#007a7f]" />
              Featured
            </h2>
            <p className="text-[#5a6c72] mb-6 text-sm">
              Get seen by more local customers, every day.
            </p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-[#1a2e35]">$29</span>
              <span className="text-[#5a6c72]">/mo</span>
              <div className="text-xs text-[#5a6c72] mt-1">
                or $199/yr{' '}
                <span className="text-[#c9786d] font-bold">(save 43%)</span>
              </div>
            </div>
            {session ? (
              <div className="space-y-2">
                <button
                  onClick={() => handleUpgrade('featured', 'monthly')}
                  disabled={!!loading}
                  className="block w-full py-3 px-6 text-center rounded-lg bg-[#007a7f] text-white font-semibold hover:bg-[#006a70] transition-colors disabled:opacity-50"
                >
                  {loading === 'featured-monthly' ? 'Redirecting...' : 'Upgrade Monthly'}
                </button>
                <button
                  onClick={() => handleUpgrade('featured', 'yearly')}
                  disabled={!!loading}
                  className="block w-full py-3 px-6 text-center rounded-lg border-2 border-[#c9786d] text-[#c9786d] font-semibold hover:bg-[#c9786d]/10 transition-colors disabled:opacity-50"
                >
                  {loading === 'featured-yearly' ? 'Redirecting...' : 'Upgrade Yearly'}
                </button>
              </div>
            ) : (
              <Link
                href="/login?callbackUrl=/pricing"
                className="block w-full py-3 px-6 text-center rounded-lg bg-[#007a7f] text-white font-semibold hover:bg-[#006a70] transition-colors"
              >
                Log In to Upgrade
              </Link>
            )}
          </div>

          {/* Expert Partner */}
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-400 p-7 relative shadow-lg">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 text-sm font-bold px-4 py-1 rounded-full flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Expert Partner
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#1a2e35] mb-2 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              Expert Partner
            </h2>
            <p className="text-[#5a6c72] mb-6 text-sm">
              One slot per category. Real local PR, every month.
            </p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-[#1a2e35]">$197</span>
              <span className="text-[#5a6c72]">/mo</span>
              <div className="text-xs text-amber-800 mt-1 font-semibold">
                or $997/yr — save $367
              </div>
              <div className="text-xs text-[#5a6c72] mt-1">
                Founding Partner rate locks in forever.
              </div>
            </div>

            <ul className="space-y-2 mb-6 text-sm">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Everything in <strong>Featured</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Monthly interview-based feature story</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Social promotion across our channels</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Newsletter placement each month</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Performance recap each month</span>
              </li>
            </ul>

            {session ? (
              <div className="space-y-2">
                <button
                  onClick={() => handleUpgrade('expert', 'monthly')}
                  disabled={!!loading}
                  className="block w-full py-3 px-6 text-center rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 font-bold hover:from-amber-600 hover:to-yellow-500 transition-colors disabled:opacity-50"
                >
                  {loading === 'expert-monthly' ? 'Redirecting...' : 'Claim Monthly — $197'}
                </button>
                <button
                  onClick={() => handleUpgrade('expert', 'yearly')}
                  disabled={!!loading}
                  className="block w-full py-3 px-6 text-center rounded-lg border-2 border-amber-600 text-amber-700 font-bold hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  {loading === 'expert-yearly' ? 'Redirecting...' : 'Claim Yearly — $997'}
                </button>
              </div>
            ) : (
              <Link
                href={`/login?callbackUrl=/pricing${initialCategory ? `?category=${initialCategory}` : ''}`}
                className="block w-full py-3 px-6 text-center rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 font-bold hover:from-amber-600 hover:to-yellow-500 transition-colors"
              >
                Log In to Claim
              </Link>
            )}

            <Link
              href="/partners"
              className="block mt-3 text-center text-xs text-[#007a7f] hover:underline"
            >
              See open categories &amp; current partners →
            </Link>
          </div>
        </div>

        {/* Pre-selected category callout */}
        {initialCategory && (
          <div className="max-w-2xl mx-auto mt-8 bg-amber-50 border border-amber-300 rounded-xl p-4 text-center">
            <p className="text-sm text-amber-900">
              <strong>You came from a category page.</strong> We&apos;ll check if{' '}
              <code className="bg-amber-100 px-1 rounded">{initialCategory}</code> is still
              available when you claim your Expert Partner slot.
            </p>
          </div>
        )}

        {/* Feature Table (Featured vs Expert Partner summary) */}
        <div className="max-w-5xl mx-auto mt-16 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-4 gap-4 p-6 bg-slate-50 border-b border-slate-100">
            <div className="text-sm font-medium text-[#5a6c72]" />
            <div className="text-center">
              <p className="font-bold text-[#1a2e35]">Free</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-[#007a7f]">⭐ Featured</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-amber-700">✨ Expert Partner</p>
            </div>
          </div>
          {[
            { label: 'Basic listing', vals: [true, true, true] },
            { label: 'Contact info & map', vals: [true, true, true] },
            { label: 'Reviews & ratings', vals: [true, true, true] },
            { label: 'Featured badge', vals: [false, true, true] },
            { label: 'Homepage featured section', vals: [false, true, true] },
            { label: 'Priority search ranking', vals: [false, true, true] },
            { label: 'Up to 10 photos', vals: [false, true, true] },
            { label: 'Coupons & deals', vals: [false, true, true] },
            { label: 'Monthly feature story', vals: [false, false, true] },
            { label: 'Social promotion', vals: [false, false, true] },
            { label: 'Newsletter placement', vals: [false, false, true] },
            { label: 'Lead capture on partner page', vals: [false, false, true] },
            { label: 'Monthly performance recap', vals: [false, false, true] },
          ].map((feature, i) => (
            <div
              key={feature.label}
              className={clsx(
                'grid grid-cols-4 gap-4 p-4 items-center text-sm',
                i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
              )}
            >
              <div className="text-[#1a2e35]">{feature.label}</div>
              {feature.vals.map((val, j) => (
                <div key={j} className="text-center">
                  {val ? (
                    <Check
                      className={clsx(
                        'w-5 h-5 mx-auto',
                        j === 2 ? 'text-amber-600' : 'text-green-500'
                      )}
                    />
                  ) : (
                    <X className="w-5 h-5 text-slate-300 mx-auto" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <p className="text-[#5a6c72] text-sm">
            Cancel anytime — your listing stays free but loses paid tier perks at the end of
            the billing period.
          </p>
        </div>
      </div>

      <FaqSection
        title="Pricing Questions"
        subtitle="Everything you need to know about listing on moval.living."
        faqs={[
          {
            question: 'What\'s the difference between Featured and Expert Partner?',
            answer:
              'Featured ($29/mo or $199/yr) is a directory listing upgrade — more photos, badge, homepage placement. Expert Partner ($197/mo or $997/yr) is an ongoing content partnership — monthly feature story, social promotion, newsletter placement, lead capture, and performance recap. Expert Partner also includes everything in Featured.',
          },
          {
            question: 'Why is Expert Partner priced so much higher than Featured?',
            answer:
              'Because it\'s actual ongoing PR work. We interview you, write a real feature story, publish it, promote it across our channels, send it to our newsletter subscribers, and give you a monthly recap. Featured is a passive upgrade; Expert Partner is an active partnership.',
          },
          {
            question: 'What\'s the "Founding Partner" rate?',
            answer:
              'The first business to claim each category locks in $197/mo or $997/yr for as long as they stay enrolled — even after we raise prices for new partners. Founding Partner is a one-time window; once all categories are claimed, the rate increases for everyone else.',
          },
          {
            question: 'What happens if my category is already claimed?',
            answer:
              'Join the waitlist from the /partners page. Waitlisted businesses get first right of refusal when a slot opens. We\'ll notify you by email.',
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
        ]}
      />
    </div>
  )
}