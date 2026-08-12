'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  User,
  Mail,
  CheckCircle,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Building2,
  Tag,
  Inbox,
} from 'lucide-react'

interface Nomination {
  id: string
  businessName: string
  businessId: string | null
  categoryName: string
  nominatorName: string
  nominatorEmail: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  emailOptIn: boolean
  createdAt: string
  reviewedAt: string | null
  rejectionReason: string | null
  promotedNomineeId: string | null
  business: {
    id: string
    name: string
    slug: string
    status: string
    logo: string | null
  } | null
}

interface Category {
  id: string
  name: string
  slug: string
  published: boolean
}

interface Props {
  initialNominations: Nomination[]
  initialCategories: Category[]
}

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'

export default function BestOfNominationsPanel({ initialNominations, initialCategories }: Props) {
  const [nominations, setNominations] = useState<Nomination[]>(initialNominations)
  const [categories] = useState<Category[]>(initialCategories)
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectionFor, setRejectionFor] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const counts = {
    PENDING: nominations.filter(n => n.status === 'PENDING').length,
    APPROVED: nominations.filter(n => n.status === 'APPROVED').length,
    REJECTED: nominations.filter(n => n.status === 'REJECTED').length,
    ALL: nominations.length,
  }

  const filtered = nominations.filter(n => filter === 'ALL' || n.status === filter)

  const approve = async (id: string, categoryId: string) => {
    setError('')
    try {
      const res = await fetch(`/api/admin/best-of/nominations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', categoryId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Approve failed')
      setNominations(prev => prev.map(n => (n.id === id ? { ...n, ...data.nomination } : n)))
      setApprovingId(null)
      setSuccess('Approved — nominee added to the category')
      setTimeout(() => setSuccess(''), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    }
  }

  const reject = async (id: string, reason: string) => {
    setError('')
    try {
      const res = await fetch(`/api/admin/best-of/nominations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectionReason: reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Reject failed')
      setNominations(prev => prev.map(n => (n.id === id ? { ...n, ...data.nomination } : n)))
      setRejectionFor(null)
      setRejectionReason('')
      setSuccess('Rejected')
      setTimeout(() => setSuccess(''), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Inbox className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-text text-lg">Best-Of Nominations</h2>
            <p className="text-xs text-text-secondary">
              {counts.PENDING} pending · {counts.APPROVED} approved · {counts.REJECTED} rejected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                filter === f ? 'bg-primary text-white' : 'bg-slate-100 text-text-secondary hover:bg-slate-200'
              }`}
            >
              {f.toLowerCase()}
              {f !== 'ALL' && counts[f] > 0 && (
                <span className={`ml-1.5 ${filter === f ? 'text-white/80' : 'text-text-secondary'}`}>
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />{success}
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-text-secondary text-sm">
              {filter === 'PENDING' ? 'No pending nominations. 🎉' : `No ${filter.toLowerCase()} nominations.`}
            </p>
          </div>
        ) : (
          filtered.map(n => (
            <NominationRow
              key={n.id}
              n={n}
              categories={categories}
              expanded={expanded === n.id}
              onToggle={() => setExpanded(expanded === n.id ? null : n.id)}
              isApproving={approvingId === n.id}
              onApproveStart={() => setApprovingId(n.id)}
              onApproveCancel={() => setApprovingId(null)}
              onApprove={(categoryId) => approve(n.id, categoryId)}
              isRejecting={rejectionFor === n.id}
              onRejectStart={() => { setRejectionFor(n.id); setRejectionReason('') }}
              onRejectCancel={() => { setRejectionFor(null); setRejectionReason('') }}
              onRejectConfirm={() => reject(n.id, rejectionReason)}
              rejectionReason={rejectionReason}
              setRejectionReason={setRejectionReason}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Single nomination row ────────────────────────────────────────────────────

function NominationRow({
  n,
  categories,
  expanded,
  onToggle,
  isApproving,
  onApproveStart,
  onApproveCancel,
  onApprove,
  isRejecting,
  onRejectStart,
  onRejectCancel,
  onRejectConfirm,
  rejectionReason,
  setRejectionReason,
}: {
  n: Nomination
  categories: Category[]
  expanded: boolean
  onToggle: () => void
  isApproving: boolean
  onApproveStart: () => void
  onApproveCancel: () => void
  onApprove: (categoryId: string) => void
  isRejecting: boolean
  onRejectStart: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
  rejectionReason: string
  setRejectionReason: (v: string) => void
}) {
  const [pickedCategoryId, setPickedCategoryId] = useState<string>('')
  const statusBadge: Record<typeof n.status, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
    APPROVED: { bg: 'bg-green-50', text: 'text-green-700', label: 'Approved' },
    REJECTED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
  }
  const badge = statusBadge[n.status]

  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-4">
        {/* Business avatar */}
        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
          {n.business?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.business.logo} alt="" className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-5 h-5 text-slate-400" />
          )}
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-text">{n.businessName}</h3>
            <span className="text-xs text-text-secondary">→</span>
            <span className="inline-flex items-center gap-1 text-sm text-text-secondary">
              <Tag className="w-3.5 h-3.5" /> {n.categoryName}
            </span>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-text-secondary flex-wrap">
            <span className="inline-flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> {n.nominatorName}
            </span>
            <a href={`mailto:${n.nominatorEmail}`} className="inline-flex items-center gap-1 hover:text-primary">
              <Mail className="w-3.5 h-3.5" /> {n.nominatorEmail}
            </a>
            <span>{new Date(n.createdAt).toLocaleDateString()}</span>
            {n.business ? (
              <span className="text-text-secondary">
                → matched: <Link href={`/business/${n.business.slug}`} className="text-primary hover:underline">{n.business.name}</Link>
                {n.business.status !== 'APPROVED' && (
                  <span className="ml-1 text-[10px] uppercase font-bold text-amber-600">({n.business.status})</span>
                )}
              </span>
            ) : (
              <span className="text-amber-600">⚠ no business match</span>
            )}
          </div>

          {/* Reason preview / expand */}
          {expanded && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-text whitespace-pre-wrap">
              {n.reason}
            </div>
          )}

          {/* Action area */}
          {expanded && n.status === 'PENDING' && (
            <div className="mt-3 space-y-3">
              {!n.businessId && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  ⚠ This nomination isn&apos;t matched to a Business yet. Use the{' '}
                  <Link href="/dashboard?tab=bestof" className="font-semibold underline">Best Of admin</Link>{' '}
                  to find/create the Business, then approve.
                </div>
              )}

              {isApproving ? (
                <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <label className="block text-xs font-semibold text-text-secondary">Add to category</label>
                  <select
                    value={pickedCategoryId}
                    onChange={e => setPickedCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">— Pick a category —</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {!c.published && '(draft)'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-text-secondary">
                    Need a new one? Create it in the{' '}
                    <Link href="/dashboard?tab=bestof" className="text-primary hover:underline">Best Of admin</Link>{' '}
                    first, then come back.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(pickedCategoryId)}
                      disabled={!pickedCategoryId}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-3.5 h-3.5 inline mr-1" /> Confirm approve
                    </button>
                    <button
                      onClick={onApproveCancel}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-text-secondary text-xs font-medium hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : isRejecting ? (
                <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <label className="block text-xs font-semibold text-text-secondary">Reason (optional, internal)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    placeholder="e.g. Duplicate of existing category X, business is closed, etc."
                    rows={2}
                    maxLength={2000}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={onRejectConfirm}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                    >
                      <X className="w-3.5 h-3.5 inline mr-1" /> Confirm reject
                    </button>
                    <button
                      onClick={onRejectCancel}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-text-secondary text-xs font-medium hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onApproveStart}
                    disabled={!n.businessId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                    title={!n.businessId ? 'Match a Business first' : 'Approve this nomination'}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={onRejectStart}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Approved/Rejected detail */}
          {expanded && n.status === 'APPROVED' && n.promotedNomineeId && (
            <p className="mt-2 text-xs text-text-secondary">
              ✓ Promoted to nominee <code className="bg-slate-100 px-1 rounded">{n.promotedNomineeId}</code>
            </p>
          )}
          {expanded && n.status === 'REJECTED' && n.rejectionReason && (
            <p className="mt-2 text-xs text-text-secondary italic">Reason: {n.rejectionReason}</p>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-text-secondary shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}