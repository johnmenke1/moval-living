'use client'

import { useState } from 'react'
import {
  Trophy, Star, Plus, Trash2, Edit2, Save, X, ChevronDown,
  Coffee, Flame, Heart, ShoppingBag, Sunrise, Beef, Pizza, ChefHat,
  RefreshCw, ExternalLink, AlertCircle, CheckCircle
} from 'lucide-react'

// Lucide icon map for category icons
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ChefHat:        ChefHat,
  Coffee:        Coffee,
  Beef:          Beef,
  Pizza:         Pizza,
  Sunrise:       Sunrise,
  Flame:         Flame,
  ShoppingBag:   ShoppingBag,
  Heart:         Heart,
  Trophy:        Trophy,
}

const FACTOR_LABELS: Record<string, string> = {
  localOwnership:        'Local Ownership',
  uniqueness:            'Uniqueness',
  communityInvolvement:  'Community Involvement',
  personalVisitReview:   'Personal Visit / Review',
}

const FACTOR_WEIGHTS: Record<string, string> = {
  localOwnership:        '10%',
  uniqueness:            '15%',
  communityInvolvement:  '10%',
  personalVisitReview:   '15%',
}

interface BestOfEntry {
  id: string
  rank: number | null
  compositeScore: number | null
  localOwnership: number
  uniqueness: number
  communityInvolvement: number
  personalVisitReview: number
  googleRating: number | null
  googleReviewCount: number | null
  yearsActive: number | null
  business: {
    id: string
    name: string
    slug: string
    address: string
    website: string | null
    logo: string | null
  }
}

interface BestOfCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  query: string
  entries: BestOfEntry[]
}

interface Props {
  initialCategories: BestOfCategory[]
}

export default function BestOfAdmin({ initialCategories }: Props) {
  const [categories, setCategories] = useState<BestOfCategory[]>(initialCategories)
  const [activeTab, setActiveTab] = useState<string>('categories')
  const [editingEntry, setEditingEntry] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [draftScores, setDraftScores] = useState<Partial<Record<string, number>>>({})

  // ── Save editorial scores ──────────────────────────────────────────────
  const saveScores = async (entryId: string) => {
    setSaving(entryId)
    setError('')
    const scores = {
      localOwnership:        draftScores.localOwnership ?? 0,
      uniqueness:            draftScores.uniqueness ?? 0,
      communityInvolvement:  draftScores.communityInvolvement ?? 0,
      personalVisitReview:   draftScores.personalVisitReview ?? 0,
    }
    try {
      const res = await fetch(`/api/admin/best-of/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scores),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      // Refresh the entry in local state
      const updated = await res.json()
      setCategories(prev => prev.map(cat => ({
        ...cat,
        entries: cat.entries.map(e => e.id === entryId ? { ...e, ...updated } : e),
      })))
      setEditingEntry(null)
      setDraftScores({})
      setSaveSuccess(entryId)
      setTimeout(() => setSaveSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  // ── Delete entry ──────────────────────────────────────────────────────
  const deleteEntry = async (categoryId: string, entryId: string) => {
    if (!confirm('Remove this entry from the category?')) return
    try {
      const res = await fetch(`/api/admin/best-of/entries/${entryId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setCategories(prev => prev.map(cat =>
        cat.id === categoryId
          ? { ...cat, entries: cat.entries.filter(e => e.id !== entryId) }
          : cat
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // ── Refresh GMB data for entry ───────────────────────────────────────
  const refreshGmb = async (entryId: string) => {
    setSaving(entryId)
    try {
      const res = await fetch(`/api/admin/best-of/entries/${entryId}/refresh-gmb`, { method: 'POST' })
      if (!res.ok) throw new Error('Refresh failed')
      const updated = await res.json()
      setCategories(prev => prev.map(cat => ({
        ...cat,
        entries: cat.entries.map(e => e.id === entryId ? { ...e, ...updated } : e),
      })))
      setSaveSuccess(entryId)
      setTimeout(() => setSaveSuccess(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setSaving(null)
    }
  }

  // ── Score badge ───────────────────────────────────────────────────────
  const ScoreBadge = ({ value, max = 10 }: { value: number; max?: number }) => {
    const pct = (value / max) * 100
    const color = pct >= 80 ? 'bg-green-100 text-green-800'
      : pct >= 50 ? 'bg-amber-100 text-amber-800'
      : 'bg-slate-100 text-slate-600'
    return (
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${color}`}>
        {value}
      </span>
    )
  }

  const StarBadge = ({ rating }: { rating: number | null }) => {
    if (rating == null) return <span className="text-xs text-slate-400">—</span>
    return (
      <span className="flex items-center gap-0.5 text-xs">
        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
        <span className="font-medium">{rating.toFixed(1)}</span>
      </span>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-text text-lg">Best Of</h2>
            <p className="text-xs text-text-secondary">{categories.length} categories</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Category tabs */}
      <div className="border-b border-slate-100 px-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {categories.map(cat => {
            const Icon = ICON_MAP[cat.icon] ?? Trophy
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  activeTab === cat.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
                {cat.entries.length > 0 && (
                  <span className="text-xs bg-slate-100 rounded-full px-1.5 py-0.5">
                    {cat.entries.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active category panel */}
      {categories.filter(c => c.id === activeTab).map(cat => (
        <div key={cat.id}>
          {cat.entries.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="font-medium text-text mb-1">No entries yet</p>
              <p className="text-sm text-text-secondary">Run the seed script to populate this category.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {cat.entries
                .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
                .map((entry, idx) => {
                  const isEditing = editingEntry === entry.id
                  const isSaving = saving === entry.id
                  const justSaved = saveSuccess === entry.id

                  return (
                    <div key={entry.id} className={`p-4 ${isEditing ? 'bg-primary/5' : ''}`}>
                      {/* Entry header row */}
                      <div className="flex items-start gap-3">
                        {/* Rank */}
                        <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                          {entry.rank ?? idx + 1}
                        </div>

                        {/* Business info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-semibold text-text text-sm">{entry.business.name}</p>
                            {entry.business.website && (
                              <a
                                href={entry.business.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-xs flex items-center gap-0.5"
                              >
                                <ExternalLink className="w-3 h-3" /> Web
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary">{entry.business.address}</p>

                          {/* Quick stats row */}
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5">
                              <StarBadge rating={entry.googleRating} />
                              {entry.googleReviewCount != null && (
                                <span className="text-xs text-text-secondary">
                                  {entry.googleReviewCount.toLocaleString()} reviews
                                </span>
                              )}
                            </div>
                            {entry.yearsActive != null && (
                              <span className="text-xs text-text-secondary">
                                {entry.yearsActive.toFixed(1)} yrs
                              </span>
                            )}
                            {entry.compositeScore != null && (
                              <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                ★ {entry.compositeScore.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {justSaved && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="w-3.5 h-3.5" /> Saved
                            </span>
                          )}
                          <button
                            onClick={() => refreshGmb(entry.id)}
                            disabled={isSaving}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
                            title="Refresh GMB data"
                          >
                            <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={() => isEditing ? setEditingEntry(null) : setEditingEntry(entry.id)}
                            className={`p-1.5 rounded-lg transition-all ${
                              isEditing
                                ? 'text-slate-400 hover:text-slate-600'
                                : 'text-text-secondary hover:text-primary hover:bg-primary/10'
                            }`}
                            title={isEditing ? 'Cancel' : 'Edit scores'}
                          >
                            {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => deleteEntry(cat.id, entry.id)}
                            className="p-1.5 rounded-lg text-text-secondary hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Editorial scoring panel */}
                      {isEditing && (
                        <div className="mt-4 pl-11 space-y-3">
                          {/* GMB scores (read-only) */}
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: 'Google Rating', value: entry.googleRating != null ? `${entry.googleRating} / 5` : 'N/A', note: '×20%' },
                              { label: 'Review Count', value: entry.googleReviewCount?.toLocaleString() ?? 'N/A', note: '×15%' },
                              { label: 'Years Active', value: entry.yearsActive != null ? `${entry.yearsActive.toFixed(1)} yrs` : 'N/A', note: '×15%' },
                            ].map(item => (
                              <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                                <p className="text-xs text-text-secondary mb-1">{item.label}</p>
                                <p className="text-lg font-bold text-text">{item.value}</p>
                                <p className="text-xs text-primary">{item.note}</p>
                              </div>
                            ))}
                          </div>

                          {/* Editorial score sliders */}
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Editorial Scores</p>
                            {(Object.keys(FACTOR_LABELS) as Array<keyof typeof FACTOR_LABELS>).map(factor => {
                              const value = draftScores[factor] ?? (entry as unknown as Record<string, number | null | undefined>)[factor] ?? 0
                              return (
                                <div key={factor} className="flex items-center gap-3">
                                  <div className="w-36 shrink-0">
                                    <p className="text-xs font-medium text-text">{FACTOR_LABELS[factor]}</p>
                                    <p className="text-xs text-primary">{FACTOR_WEIGHTS[factor]}</p>
                                  </div>
                                  <input
                                    type="range"
                                    min={0}
                                    max={10}
                                    step={1}
                                    value={value}
                                    onChange={e => setDraftScores(prev => ({ ...prev, [factor]: Number(e.target.value) }))}
                                    className="flex-1 accent-primary"
                                  />
                                  <ScoreBadge value={value} />
                                </div>
                              )
                            })}
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              onClick={() => { setEditingEntry(null); setDraftScores({}) }}
                              className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-slate-100 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveScores(entry.id)}
                              disabled={isSaving}
                              className="btn-primary text-sm flex items-center gap-2"
                            >
                              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              Save Scores
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
