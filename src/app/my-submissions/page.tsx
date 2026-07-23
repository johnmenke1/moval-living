'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Building2, Clock, CheckCircle, XCircle, ArrowRight, MapPin, Phone } from 'lucide-react'

interface Business {
  id: string
  name: string
  slug: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  status: string
  createdAt: string
  category: { name: string } | null
}

export default function MySubmissionsPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')
    setSearched(false)

    try {
      const res = await fetch(`/api/businesses/by-email?email=${encodeURIComponent(email.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setBusinesses(data.businesses || [])
      setSearched(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    PENDING: { label: 'Pending Review', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: <Clock className="w-4 h-4" /> },
    APPROVED: { label: 'Live', color: 'text-green-600 bg-green-50 border-green-200', icon: <CheckCircle className="w-4 h-4" /> },
    REJECTED: { label: 'Not Approved', color: 'text-red-600 bg-red-50 border-red-200', icon: <XCircle className="w-4 h-4" /> },
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <h1 className="text-3xl font-bold text-text mb-2">My Submissions</h1>
          <p className="text-text-secondary">Find and manage businesses you submitted to moval.living</p>
        </div>
      </div>

      <div className="container-max py-8">
        <div className="max-w-xl mx-auto">
          {/* Search Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-text">Find your submissions</h2>
                <p className="text-sm text-text-secondary">Enter the email you used when submitting</p>
              </div>
            </div>

            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="btn-primary w-full justify-center flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Find My Submissions'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-lg">{error}</div>
            )}

            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs text-text-secondary">
                Don't have an account?{' '}
                <Link href="/submit" className="text-primary hover:underline font-medium">
                  Submit a new business
                </Link>
                {' '}or{' '}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  sign in
                </Link>
                {' '}to manage listings you own.
              </p>
            </div>
          </div>

          {/* Results */}
          {searched && (
            <div className="mt-6 space-y-4">
              {businesses.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-semibold text-text mb-1">No submissions found</h3>
                  <p className="text-sm text-text-secondary mb-4">
                    We couldn't find any businesses submitted with <strong>{email}</strong>.
                  </p>
                  <Link href="/submit" className="btn-primary text-sm inline-flex items-center gap-2">
                    Submit a Business <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-sm text-text-secondary font-medium">
                    {businesses.length} submission{businesses.length !== 1 ? 's' : ''} found
                  </p>
                  {businesses.map(biz => {
                    const status = statusConfig[biz.status] || statusConfig.PENDING
                    return (
                      <div key={biz.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-text truncate">{biz.name}</h3>
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${status.color}`}>
                                {status.icon}
                                {status.label}
                              </span>
                            </div>
                            {biz.category && (
                              <p className="text-xs text-text-secondary mb-2">{biz.category.name}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {[biz.address, biz.city, biz.state, biz.zip].filter(Boolean).join(', ')}
                              </span>
                              {biz.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5" />
                                  {biz.phone}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {biz.status === 'APPROVED' && (
                              <Link
                                href={`/business/${biz.slug}`}
                                className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
                              >
                                View Live <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            )}
                            {biz.status === 'PENDING' && (
                              <span className="text-xs text-text-secondary italic">
                                Under review
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
