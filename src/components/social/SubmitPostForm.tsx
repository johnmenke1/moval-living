'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ExternalLink, Search, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InstagramIcon, FacebookIcon } from './SocialIcons'

interface Business {
  id: string
  name: string
  slug: string
  logo?: string | null
}

interface SubmitPostFormProps {
  businesses: Business[]
}

export default function SubmitPostForm({ businesses }: SubmitPostFormProps) {
  const router = useRouter()
  const [platform, setPlatform] = useState<'INSTAGRAM' | 'FACEBOOK' | ''>('')
  const [postUrl, setPostUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [submittedBy, setSubmittedBy] = useState('')
  const [urlError, setUrlError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [businessSearch, setBusinessSearch] = useState('')

  const filteredBusinesses = businesses.filter(b =>
    b.name.toLowerCase().includes(businessSearch.toLowerCase())
  )

  const validateUrl = (url: string, platform: string) => {
    if (!url) return ''
    try {
      const host = new URL(url).hostname
      if (platform === 'INSTAGRAM' && !host.includes('instagram')) {
        return 'Please enter a valid Instagram post URL'
      }
      if (platform === 'FACEBOOK' && !host.includes('facebook')) {
        return 'Please enter a valid Facebook post URL'
      }
    } catch {
      return 'Please enter a valid URL'
    }
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setUrlError('')

    const err = validateUrl(postUrl, platform)
    if (err) { setUrlError(err); return }

    if (!postUrl || !platform) {
      setError('Platform and post URL are required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, postUrl, caption: caption || null, businessId: businessId || null, submittedBy: submittedBy || null }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Something went wrong')
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/submit/social-posts/success'), 1500)
    } catch {
      setError('Failed to submit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-text mb-2">Post Submitted!</h2>
        <p className="text-text-secondary">We&apos;ll review it and add it to the events page shortly.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Platform */}
      <div>
        <label className="block text-sm font-medium text-text mb-3">Platform</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setPlatform('INSTAGRAM'); setUrlError('') }}
            className={cn(
              'flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all',
              platform === 'INSTAGRAM'
                ? 'border-instagram bg-instagram/5 text-instagram'
                : 'border-slate-100 hover:border-slate-200 text-text-secondary'
            )}
          >
            <InstagramIcon className="w-5 h-5" />
            <span className="font-medium">Instagram</span>
          </button>
          <button
            type="button"
            onClick={() => { setPlatform('FACEBOOK'); setUrlError('') }}
            className={cn(
              'flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all',
              platform === 'FACEBOOK'
                ? 'border-[#1877F2] bg-[#1877F2]/5 text-[#1877F2]'
                : 'border-slate-100 hover:border-slate-200 text-text-secondary'
            )}
          >
            <FacebookIcon className="w-5 h-5" />
            <span className="font-medium">Facebook</span>
          </button>
        </div>
      </div>

      {/* Post URL */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          Post URL <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          value={postUrl}
          onChange={e => { setPostUrl(e.target.value); setUrlError('') }}
          placeholder={platform === 'INSTAGRAM' ? 'https://www.instagram.com/p/...' : 'https://www.facebook.com/...'}
          className={cn(
            'w-full px-4 py-3 rounded-xl border bg-white',
            urlError ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-primary',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all'
          )}
        />
        {urlError && <p className="text-red-500 text-sm mt-1">{urlError}</p>}
        <p className="text-text-secondary text-xs mt-1.5">
          Copy the link directly from the Instagram or Facebook post
        </p>
      </div>

      {/* Caption */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          Caption <span className="text-text-secondary font-normal">(optional)</span>
        </label>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={3}
          placeholder="Add context about this event or opportunity..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
        />
      </div>

      {/* Link to Business */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          Link to a Business <span className="text-text-secondary font-normal">(optional)</span>
        </label>
        {businessId ? (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            {businesses.find(b => b.id === businessId)?.logo ? (
              <img
                src={businesses.find(b => b.id === businessId)?.logo!}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">
                  {businesses.find(b => b.id === businessId)?.name[0]}
                </span>
              </div>
            )}
            <span className="text-sm font-medium text-text flex-1">
              {businesses.find(b => b.id === businessId)?.name}
            </span>
            <button
              type="button"
              onClick={() => setBusinessId('')}
              className="text-text-secondary hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={businessSearch}
              onChange={e => setBusinessSearch(e.target.value)}
              placeholder="Search for a business..."
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {businessSearch && filteredBusinesses.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-10 max-h-48 overflow-y-auto">
                {filteredBusinesses.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => { setBusinessId(b.id); setBusinessSearch('') }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                  >
                    {b.logo ? (
                      <img src={b.logo} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{b.name[0]}</span>
                      </div>
                    )}
                    <span className="text-sm text-text">{b.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="text-text-secondary text-xs mt-1.5">
          Associate this post with a business on moval.living
        </p>
      </div>

      {/* Submitted By */}
      <div>
        <label className="block text-sm font-medium text-text mb-1.5">
          Your Name or Email <span className="text-text-secondary font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={submittedBy}
          onChange={e => setSubmittedBy(e.target.value)}
          placeholder="So we can credit you"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          <X className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Submitting...' : 'Submit Post'}
      </button>
    </form>
  )
}
