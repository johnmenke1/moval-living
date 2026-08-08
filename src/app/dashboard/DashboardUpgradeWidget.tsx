'use client'

import { useState } from 'react'
import { Star, Sparkles, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function DashboardUpgradeWidget() {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleUpgrade = async (
    tier: 'featured' | 'expert',
    interval: 'monthly' | 'yearly'
  ) => {
    setLoading(`${tier}-${interval}`)
    setError('')
    try {
      const res = await fetch(
        `/api/stripe/checkout?interval=${interval}&tier=${tier}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error || `Checkout failed (${res.status})`)
      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error('No checkout URL returned')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}
      {/* Featured upgrade */}
      <div className="bg-gradient-to-br from-[#007a7f] to-[#00405c] rounded-xl p-6 text-white">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold mb-1">Upgrade to Featured</h3>
            <p className="text-white/70 text-sm">
              Get homepage placement, priority ranking, and coupons — from
              $29/month.
            </p>
          </div>
          <Star className="w-6 h-6 text-[#c9786d] fill-[#c9786d] flex-shrink-0 ml-3" />
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => handleUpgrade('featured', 'monthly')}
            disabled={loading !== null}
            className="flex-1 py-2 px-4 bg-white text-[#007a7f] rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === 'featured-monthly' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            $29/month
          </button>
          <button
            onClick={() => handleUpgrade('featured', 'yearly')}
            disabled={loading !== null}
            className="flex-1 py-2 px-4 bg-[#c9786d] text-white rounded-lg font-semibold text-sm hover:bg-[#c9786d]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === 'featured-yearly' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            $199/year — save 43%
          </button>
        </div>
      </div>

      {/* Expert Partner upgrade */}
      <div className="bg-gradient-to-br from-amber-500 to-yellow-400 rounded-xl p-6 text-amber-950">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide bg-amber-950/20 px-2 py-0.5 rounded-full mb-2">
              <Sparkles className="w-3 h-3" />
              Limited — one per category
            </div>
            <h3 className="text-lg font-bold mb-1">Become an Expert Partner</h3>
            <p className="text-amber-900/80 text-sm">
              Monthly feature story, social promotion, newsletter placement, lead
              capture — a real ongoing local PR engine.
            </p>
          </div>
          <Sparkles className="w-6 h-6 text-amber-950 flex-shrink-0 ml-3" />
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => handleUpgrade('expert', 'monthly')}
            disabled={loading !== null}
            className="flex-1 py-2 px-4 bg-amber-950 text-white rounded-lg font-semibold text-sm hover:bg-amber-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === 'expert-monthly' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            $197/month
          </button>
          <button
            onClick={() => handleUpgrade('expert', 'yearly')}
            disabled={loading !== null}
            className="flex-1 py-2 px-4 bg-white text-amber-900 border-2 border-amber-950 rounded-lg font-semibold text-sm hover:bg-amber-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === 'expert-yearly' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            $997/year — save $367
          </button>
        </div>
        <Link
          href="/partners"
          className="block text-center text-xs font-semibold text-amber-900 hover:underline mt-3"
        >
          See open categories &amp; what you get →
        </Link>
      </div>
    </div>
  )
}