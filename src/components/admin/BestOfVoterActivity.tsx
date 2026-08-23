'use client'

/**
 * BestOfVoterActivity — admin-only voter activity dashboard.
 *
 * Mounted inside BestOfAdmin at the top of the page (above the
 * category list). Shows:
 *   - Recent vote stream (newest first)
 *   - Top voters by activity (most-engaged Owners)
 *   - Per-nominee totals when a category is selected
 *
 * Polls every 30s — admin dashboards don't need real-time, and this
 * keeps the implementation simple. If we want real-time, switch to
 * server-sent events in a future version.
 */

import { useEffect, useState } from 'react'
import { Loader2, User, Clock, TrendingUp } from 'lucide-react'
import { timeAgo } from './best-of-voter-activity-helpers'

interface RecentVote {
  id: string
  voterName: string
  voterImage: string | null
  voterEmail: string | null
  votedAt: string
  nominee: { id: string; name: string; slug: string }
  category: { id: string; name: string; slug: string }
}

interface TopVoter {
  voterId: string
  voterName: string
  voterEmail: string | null
  voterImage: string | null
  voteCount: number
}

interface PerNominee {
  nomineeId: string
  nomineeName: string
  voteCount: number
}

interface AdminVotesResponse {
  recentVotes: RecentVote[]
  topVoters: TopVoter[]
  perNominee: PerNominee[] | null
}

export function BestOfVoterActivity() {
  const [data, setData] = useState<AdminVotesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/admin/best-of/votes?limit=50', {
        cache: 'no-store',
      })
      if (!res.ok) {
        if (res.status === 403) {
          setError('Admin only')
        } else {
          throw new Error(`HTTP ${res.status}`)
        }
        return
      }
      const body = (await res.json()) as AdminVotesResponse
      setData(body)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-2 text-text-secondary">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading voter activity…
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl p-6 text-red-700">
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* Recent vote stream */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-text-secondary" />
          <h2 className="text-sm font-bold text-text">Recent votes</h2>
          <span className="text-xs text-text-secondary ml-auto">
            {data.recentVotes.length} most recent
          </span>
        </div>
        {data.recentVotes.length === 0 ? (
          <p className="text-xs text-text-secondary py-4 text-center">
            No votes yet. Share the voting pages to get started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.recentVotes.slice(0, 10).map((v) => (
              <li key={v.id} className="py-2 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-text-secondary">
                  {v.voterImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.voterImage}
                      alt={v.voterName}
                      width={28}
                      height={28}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    v.voterName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text">
                    <span className="font-medium">{v.voterName}</span>
                    <span className="text-text-secondary"> voted for </span>
                    <span className="font-medium">{v.nominee.name}</span>
                  </p>
                  <p className="text-[10px] text-text-secondary">
                    {v.category.name} · {timeAgo(v.votedAt)}
                    {v.voterEmail && ` · ${v.voterEmail}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Top voters */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-text-secondary" />
          <h2 className="text-sm font-bold text-text">Top voters</h2>
          <span className="text-xs text-text-secondary ml-auto">
            Most-engaged members
          </span>
        </div>
        {data.topVoters.length === 0 ? (
          <p className="text-xs text-text-secondary py-4 text-center">
            No active voters yet.
          </p>
        ) : (
          <ol className="space-y-2">
            {data.topVoters.slice(0, 10).map((voter, idx) => (
              <li
                key={voter.voterId}
                className="flex items-center gap-3 py-1.5"
              >
                <span className="text-xs font-bold text-text-secondary w-5 text-right">
                  #{idx + 1}
                </span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                  {voter.voterImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={voter.voterImage}
                      alt={voter.voterName}
                      width={28}
                      height={28}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">
                    {voter.voterName}
                  </p>
                  {voter.voterEmail && (
                    <p className="text-[10px] text-text-secondary truncate">
                      {voter.voterEmail}
                    </p>
                  )}
                </div>
                <span className="text-sm font-bold text-primary">
                  {voter.voteCount}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
