'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, MapPin, Share2, Navigation, Trophy, Check } from 'lucide-react'
import { TurnstileWidget } from '@/components/turnstile/TurnstileWidget'
import type { PublicHalloweenEntry } from '@/lib/halloween-queries'
import type { ContestState } from '@/lib/halloween'

const HauntedMap = dynamic(() => import('./HauntedMap').then((m) => m.HauntedMap), {
  ssr: false,
  loading: () => <div className="w-full h-full min-h-[320px] rounded-2xl bg-[#140a22] animate-pulse" />,
})

interface Props {
  initialEntries: PublicHalloweenEntry[]
  initialState: ContestState
  categories: string[]
  votingOpensLabel: string
}

type Sort = 'votes' | 'newest' | 'name'

export function HauntedExplorer({ initialEntries, initialState, categories, votingOpensLabel }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [state, setState] = useState(initialState)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [sort, setSort] = useState<Sort>('votes')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [captchaFor, setCaptchaFor] = useState<string | null>(null)
  const [captchaTry, setCaptchaTry] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map())

  const flash = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Refresh with this device's vote state + live counts.
  useEffect(() => {
    let cancelled = false
    fetch('/api/halloween/entries', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        setEntries(d.entries)
        setVotedIds(new Set(d.votedIds))
        setState(d.state)
      })
      .catch(() => {})
    const id = new URLSearchParams(window.location.search).get('home')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setSelectedId(id)
    return () => { cancelled = true }
  }, [])

  const select = useCallback((id: string) => {
    setSelectedId(id)
    cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = entries.filter((e) => {
      if (category && e.category !== category) return false
      if (!q) return true
      return [e.displayName, e.tagline, e.locationLabel, e.description].some((s) => s?.toLowerCase().includes(q))
    })
    const sorted = [...list]
    if (sort === 'votes') sorted.sort((a, b) => b.votes - a.votes || a.displayName.localeCompare(b.displayName))
    else if (sort === 'newest') sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    else sorted.sort((a, b) => a.displayName.localeCompare(b.displayName))
    return sorted
  }, [entries, query, category, sort])

  const leaders = useMemo(
    () => [...entries].filter((e) => e.votes > 0).sort((a, b) => b.votes - a.votes).slice(0, 3),
    [entries],
  )
  const totalVotes = entries.reduce((n, e) => n + e.votes, 0)

  const castVote = useCallback(
    async (entryId: string, token?: string) => {
      setBusyId(entryId)
      try {
        const res = await fetch('/api/halloween/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryId, turnstileToken: token }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok || data.alreadyVoted) {
          setVotedIds((s) => new Set(s).add(entryId))
          if (typeof data.votes === 'number') {
            setEntries((list) => list.map((e) => (e.id === entryId ? { ...e, votes: data.votes } : e)))
          }
          setCaptchaFor(null)
          flash(res.ok ? 'Vote counted - thanks for haunting with us! 🎃' : 'You already voted for this home.')
        } else if (data.needsCaptcha) {
          // Show (or refresh) the check - a used/expired token needs a brand-new widget.
          setCaptchaFor(entryId)
          setCaptchaTry((n) => n + 1)
          if (token) flash('That check expired - please try it once more.')
        } else {
          setCaptchaFor(null)
          flash(data.error ?? 'Could not record your vote.')
        }
      } catch {
        flash('Network hiccup - please try again.')
      } finally {
        setBusyId(null)
      }
    },
    [flash],
  )

  const share = useCallback(async (e: PublicHalloweenEntry) => {
    const url = `${window.location.origin}/halloween?home=${e.id}`
    try {
      if (navigator.share) await navigator.share({ title: e.displayName, text: `Vote for ${e.displayName} in MoVal Haunted Homes!`, url })
      else {
        await navigator.clipboard.writeText(url)
        flash('Link copied!')
      }
    } catch { /* user cancelled */ }
  }, [flash])

  return (
    <div>
      {/* Stats + leaderboard */}
      <div className="grid gap-4 md:grid-cols-[1fr_2fr] mb-6">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Haunted homes" value={entries.length} />
          <Stat label="Votes cast" value={totalVotes} />
        </div>
        <div className="rounded-2xl border border-[#3a1d57] bg-[#160b24] p-4">
          <div className="flex items-center gap-2 text-orange-300 text-sm font-semibold mb-2">
            <Trophy className="w-4 h-4" /> Leaderboard
          </div>
          {leaders.length === 0 ? (
            <p className="text-sm text-purple-200/70">
              {state.votingOpen ? 'No votes yet - be the first to vote!' : `Voting opens ${votingOpensLabel}.`}
            </p>
          ) : (
            <ol className="grid gap-2 sm:grid-cols-3">
              {leaders.map((e, i) => (
                <li key={e.id}>
                  <button onClick={() => select(e.id)} className="w-full text-left rounded-xl bg-[#1f0f33] hover:bg-[#2a1546] px-3 py-2 transition">
                    <span className="text-xs text-orange-300">{['🥇', '🥈', '🥉'][i]} #{i + 1}</span>
                    <span className="block text-sm font-semibold text-white truncate">{e.displayName}</span>
                    <span className="text-xs text-purple-200/70">{e.votes} vote{e.votes === 1 ? '' : 's'}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search homes or streets…"
            className="w-full rounded-xl bg-[#160b24] border border-[#3a1d57] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-purple-300/50 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </label>
        {categories.length > 0 && (
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category"
            className="rounded-xl bg-[#160b24] border border-[#3a1d57] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort"
          className="rounded-xl bg-[#160b24] border border-[#3a1d57] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="votes">Most votes</option>
          <option value="newest">Newest</option>
          <option value="name">A-Z</option>
        </select>
      </div>

      {/* Map + list */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="order-1 lg:order-2 h-[360px] lg:h-[680px] lg:sticky lg:top-24">
          <HauntedMap entries={visible} selectedId={selectedId} onSelect={select} />
        </div>
        <div className="order-2 lg:order-1 space-y-3 lg:max-h-[680px] lg:overflow-y-auto lg:pr-1">
          {visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#3a1d57] p-8 text-center text-purple-200/80 text-sm">
              {entries.length === 0
                ? 'No homes are on the map yet. Be the first to enter!'
                : 'No homes match your search.'}
            </div>
          )}
          {visible.map((e) => {
            const voted = votedIds.has(e.id)
            const selected = selectedId === e.id
            return (
              <article
                key={e.id}
                ref={(el) => { if (el) cardRefs.current.set(e.id, el); else cardRefs.current.delete(e.id) }}
                className={`rounded-2xl border bg-[#160b24] overflow-hidden transition ${selected ? 'border-orange-400 shadow-[0_0_24px_rgba(255,122,26,0.25)]' : 'border-[#3a1d57]'}`}
              >
                <button onClick={() => select(e.id)} className="block w-full text-left">
                  {e.photoUrls[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.photoUrls[0]} alt={`${e.displayName} Halloween display`} loading="lazy" className="w-full h-48 object-cover" />
                  )}
                </button>
                {selected && e.photoUrls.length > 1 && (
                  <div className="flex gap-2 p-2 bg-[#120920] overflow-x-auto">
                    {e.photoUrls.slice(1).map((u) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={u} src={u} alt="" loading="lazy" className="h-24 w-auto rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-halloween text-xl text-white leading-tight">{e.displayName}</h3>
                      {e.tagline && <p className="text-sm text-orange-200/90">{e.tagline}</p>}
                      <p className="mt-1 flex items-center gap-1 text-xs text-purple-200/70">
                        <MapPin className="w-3 h-3 shrink-0" /> {e.locationLabel}
                        {e.category && <span className="ml-2 rounded-full bg-[#2a1546] px-2 py-0.5 text-[11px] text-purple-100">{e.category}</span>}
                      </p>
                    </div>
                    <div className="text-center shrink-0">
                      <div className="text-2xl font-bold text-orange-300 leading-none">{e.votes}</div>
                      <div className="text-[11px] text-purple-200/60">vote{e.votes === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                  {selected && e.description && <p className="mt-3 text-sm text-purple-100/90 whitespace-pre-line">{e.description}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {state.votingOpen ? (
                      <button
                        onClick={() => castVote(e.id)}
                        disabled={voted || busyId === e.id}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${voted ? 'bg-[#2a1546] text-purple-200 cursor-default' : 'bg-orange-500 hover:bg-orange-400 text-[#1b0b2e]'} disabled:opacity-70`}
                      >
                        {voted ? <><Check className="w-4 h-4" /> Voted</> : busyId === e.id ? 'Voting…' : '🎃 Vote'}
                      </button>
                    ) : (
                      <span className="text-xs text-purple-200/70">
                        {state.phase === 'closed' ? 'Voting has closed' : `Voting opens ${votingOpensLabel}`}
                      </span>
                    )}
                    {e.latitude != null && e.longitude != null && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${e.latitude},${e.longitude}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#3a1d57] px-3 py-2 text-sm text-purple-100 hover:bg-[#2a1546]"
                      >
                        <Navigation className="w-4 h-4" /> Directions
                      </a>
                    )}
                    <button onClick={() => share(e)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#3a1d57] px-3 py-2 text-sm text-purple-100 hover:bg-[#2a1546]">
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                  </div>
                  {!e.exactAddress && (
                    <p className="mt-2 text-[11px] text-purple-300/50">Pin is approximate to protect the family&apos;s privacy.</p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {/* CAPTCHA modal - only shown for a device's very first vote */}
      {captchaFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-[#3a1d57] bg-[#160b24] p-6 text-center">
            <p className="font-halloween text-2xl text-white mb-1">Quick check 👻</p>
            <p className="text-sm text-purple-200/80 mb-4">Confirm you&apos;re human to cast your vote.</p>
            <div className="flex justify-center">
              <TurnstileWidget key={captchaTry} theme="dark" onVerify={(t) => castVote(captchaFor, t)} />
            </div>
            <button onClick={() => setCaptchaFor(null)} className="mt-4 text-sm text-purple-300/80 underline">Cancel</button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-orange-500 text-[#1b0b2e] px-5 py-2.5 text-sm font-semibold shadow-lg" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#3a1d57] bg-[#160b24] p-4">
      <div className="text-3xl font-bold text-orange-300">{value.toLocaleString()}</div>
      <div className="text-xs text-purple-200/70 mt-1">{label}</div>
    </div>
  )
}
