'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { Building2, UserPlus, Loader2, CheckCircle, AlertCircle, Globe } from 'lucide-react'

interface BusinessSidebarProps {
  business: {
    slug: string
    name: string
    ownerId: string | null
    email: string | null
  }
}

export function BusinessSidebar({ business }: BusinessSidebarProps) {
  const { data: session } = useSession()
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claimError, setClaimError] = useState('')
  const [email, setEmail] = useState('')

  const isLoggedIn = !!session?.user
  const isOwner = isLoggedIn && session?.user?.id === business.ownerId
  const isClaimed = !!business.ownerId

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setClaiming(true)
    setClaimError('')

    try {
      const res = await fetch('/api/claim/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: business.slug, email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to request claim')
      setClaimed(true)
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setClaiming(false)
    }
  }

  // ── Owner is logged in ──
  if (isOwner) {
    return (
      <>
        <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5" />
            <h3 className="text-lg font-bold">You own this listing</h3>
          </div>
          <p className="text-blue-100 text-sm mb-4">You can update photos, hours, deals, and more from your dashboard.</p>
          <Link href="/dashboard" className="block text-center bg-white text-primary font-bold py-2.5 px-4 rounded-lg hover:bg-blue-50 transition-colors">
            Go to Dashboard
          </Link>
        </div>
        <WebsiteUpsell />
      </>
    )
  }

  // ── Business is already claimed by someone else ──
  if (isClaimed) {
    return (
      <>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-text">Listing Claimed</h3>
          </div>
          <p className="text-text-secondary text-sm">This business has been verified by its owner.</p>
        </div>
        <WebsiteUpsell />
      </>
    )
  }

  // ── Not logged in ──
  if (!isLoggedIn) {
    if (claimed) {
      return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-text mb-2">Check your inbox!</h3>
          <p className="text-text-secondary text-sm">
            We sent a claim link to <strong>{email}</strong>. Click it to verify ownership and manage {business.name}.
          </p>
        </div>
      )
    }

    return (
      <>
        {/* Claim CTA */}
        <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-5 h-5" />
            <h3 className="text-lg font-bold">Claim this listing</h3>
          </div>
          <p className="text-blue-100 text-sm mb-4">
            Are you the owner of {business.name}? Verify your ownership and get free access to manage your listing.
          </p>
          <form onSubmit={handleClaim} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Your business email"
              className="w-full px-3 py-2 rounded-lg text-text text-sm bg-white"
              required
            />
            {claimError && (
              <p className="text-red-200 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {claimError}
              </p>
            )}
            <button
              type="submit"
              disabled={claiming || !email.trim()}
              className="w-full flex items-center justify-center gap-2 bg-white text-primary font-bold py-2.5 px-4 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {claiming ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><UserPlus className="w-4 h-4" /> Claim This Business</>}
            </button>
          </form>
        </div>

        {/* Sign in prompt */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-text-secondary text-sm mb-3">Already have an account?</p>
          <button
            onClick={() => signIn(undefined, { callbackUrl: `/dashboard` })}
            className="w-full text-center bg-slate-100 text-text font-medium py-2 px-4 rounded-lg hover:bg-slate-200 transition-colors text-sm"
          >
            Sign in to manage a listing
          </button>
        </div>
        <WebsiteUpsell />
      </>
    )
  }

  // ── Logged in but not the owner ──
  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center">
        <AlertCircle className="w-8 h-8 text-text-secondary mx-auto mb-3" />
        <h3 className="font-bold text-text mb-1">Not your listing?</h3>
        <p className="text-text-secondary text-sm">This listing is owned by another account. Contact us if you believe this is incorrect.</p>
      </div>
      <WebsiteUpsell />
    </>
  )
}

function WebsiteUpsell() {
  return (
    <div className="bg-accent/10 border border-accent/20 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-bold text-text">Need a Website?</h3>
      </div>
      <p className="text-text-secondary text-sm mb-4">We build professional websites for local businesses. Get yours started today!</p>
      <a
        href="mailto:hello@moval.living?subject=Website%20Inquiry"
        className="block text-center bg-accent text-white font-bold py-2.5 px-4 rounded-lg hover:opacity-90 transition-opacity text-sm"
      >
        Get a Free Quote
      </a>
    </div>
  )
}
