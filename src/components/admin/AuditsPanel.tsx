'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Activity,
  Search,
  RefreshCw,
  X,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  Globe,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Calendar,
  Shield,
  Sparkles,
  Layers,
} from 'lucide-react'
import { clsx } from 'clsx'

interface Audit {
  id: string
  businessId: string
  businessName: string
  businessSlug: string
  businessWebsite: string | null
  businessEmail: string | null
  businessPhone: string | null
  categoryName: string
  score: number
  httpStatus: number | null
  finalUrl: string | null
  pageLoadMs: number | null
  contentLength: number | null
  hasSsl: boolean
  isMobileFriendly: boolean
  hasTitle: boolean
  hasMetaDescription: boolean
  hasSingleH1: boolean
  hasSitemap: boolean
  hasRobotsTxt: boolean
  hasSchemaOrg: boolean
  hasOpenGraph: boolean
  hasAltTextCoverage: boolean
  hasContactForm: boolean
  hasVisibleEmail: boolean
  foundEmail: string | null
  foundPhone: string | null
  hasGoogleAnalytics: boolean
  hasGoogleTagManager: boolean
  hasMetaPixel: boolean
  copyrightYear: number | null
  hasDeprecatedHtml: boolean
  hasBlog: boolean
  auditedAt: string
  usedTavily: boolean
  fallbackReason?: string
}

interface Stats {
  totalAudits: number
  totalBusinesses: number
  withEmail: number
  tavilyUsed: number
  avgScore: number
  tierCounts: { critical: number; fair: number; good: number; solid: number }
}

type Tier = 'all' | 'critical' | 'fair' | 'good' | 'solid'

const TIER_STYLE: Record<
  Exclude<Tier, 'all'>,
  { label: string; color: string; bg: string; ring: string }
> = {
  critical: {
    label: 'Critical',
    color: 'text-red-700',
    bg: 'bg-red-50',
    ring: 'ring-red-200',
  },
  fair: {
    label: 'Fair',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
  },
  good: {
    label: 'Good',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
  },
  solid: {
    label: 'Solid',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
  },
}

function scoreTier(score: number): Exclude<Tier, 'all'> {
  if (score < 40) return 'critical'
  if (score < 70) return 'fair'
  if (score < 85) return 'good'
  return 'solid'
}

export default function AuditsPanel() {
  const [audits, setAudits] = useState<Audit[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<Tier>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [emailsOnly, setEmailsOnly] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('limit', '500')
      if (tierFilter !== 'all') params.set('tier', tierFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/audits?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      let rows = data.audits as Audit[]
      if (emailsOnly) rows = rows.filter((a) => a.foundEmail)
      setAudits(rows)
      setStats(data.stats)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load audits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierFilter, emailsOnly])

  // Re-search on user input (debounced)
  useEffect(() => {
    const t = setTimeout(() => load(), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const groupedByTier = useMemo(() => {
    const groups: Record<Exclude<Tier, 'all'>, Audit[]> = {
      critical: [],
      fair: [],
      good: [],
      solid: [],
    }
    for (const a of audits) groups[scoreTier(a.score)].push(a)
    return groups
  }, [audits])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Site Audits</h2>
          <p className="text-sm text-slate-600 mt-1">
            Last audit per business. Free scraper (Pass 1) + Tavily fallback (Pass 2, when Cloudflare blocks).
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#007a7f] text-white text-sm font-semibold hover:bg-[#00405c] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard
            icon={Activity}
            label="Audited"
            value={stats.totalBusinesses}
            color="text-slate-700 bg-slate-100"
          />
          <StatCard
            icon={Mail}
            label="Emails found"
            value={`${stats.withEmail}`}
            color="text-purple-700 bg-purple-100"
            subtext={
              stats.totalBusinesses > 0
                ? `${Math.round((stats.withEmail / stats.totalBusinesses) * 100)}% yield`
                : ''
            }
          />
          <StatCard
            icon={Sparkles}
            label="Tavily used"
            value={`${stats.tavilyUsed}`}
            color="text-amber-700 bg-amber-100"
            subtext="(12% of total)"
          />
          <StatCard
            icon={Activity}
            label="Avg score"
            value={`${stats.avgScore}/100`}
            color="text-blue-700 bg-blue-100"
          />
          <StatCard
            icon={Layers}
            label="By tier"
            value={null}
            inline={
              <div className="text-[10px] mt-1 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-red-700">Critical</span>
                  <span className="font-bold text-slate-900">{stats.tierCounts.critical}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-700">Fair</span>
                  <span className="font-bold text-slate-900">{stats.tierCounts.fair}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-emerald-700">Good</span>
                  <span className="font-bold text-slate-900">{stats.tierCounts.good}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-blue-700">Solid</span>
                  <span className="font-bold text-slate-900">{stats.tierCounts.solid}</span>
                </div>
              </div>
            }
            color="text-slate-700 bg-slate-100"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search business name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-[#007a7f] focus:ring-2 focus:ring-[#007a7f]/20 outline-none"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'critical', 'fair', 'good', 'solid'] as Tier[]).map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={clsx(
                  'px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
                  tierFilter === t
                    ? 'bg-[#007a7f] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                )}
              >
                {t === 'all' ? 'All' : TIER_STYLE[t].label}
              </button>
            ))}
            <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={emailsOnly}
                onChange={(e) => setEmailsOnly(e.target.checked)}
                className="rounded border-slate-300"
              />
              Has email
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}

      {loading && audits.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          Loading audits…
        </div>
      ) : audits.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          No audits match the current filters.
        </div>
      ) : (
        <div className="space-y-2">
          {(['critical', 'fair', 'good', 'solid'] as Exclude<Tier, 'all'>[]).map(
            (tier) =>
              groupedByTier[tier].length === 0 ? null : (
                <div key={tier}>
                  <div className="flex items-center gap-2 mb-1.5 mt-3 first:mt-0 px-1">
                    <span
                      className={clsx(
                        'text-xs font-bold uppercase tracking-wider',
                        TIER_STYLE[tier].color
                      )}
                    >
                      {TIER_STYLE[tier].label}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({groupedByTier[tier].length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {groupedByTier[tier].map((a) => (
                      <AuditRow
                        key={a.id}
                        audit={a}
                        expanded={expandedId === a.id}
                        onToggle={() =>
                          setExpandedId(expandedId === a.id ? null : a.id)
                        }
                      />
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
  inline,
}: {
  icon: any
  label: string
  value: string | number | null
  subtext?: string
  color: string
  inline?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-2', color)}>
        <Icon className="w-4 h-4" />
      </div>
      {value !== null && <p className="text-2xl font-bold text-slate-900">{value}</p>}
      {inline}
      <p className="text-xs text-slate-600 mt-1">{label}</p>
      {subtext && <p className="text-[10px] text-slate-400 mt-0.5">{subtext}</p>}
    </div>
  )
}

function AuditRow({
  audit,
  expanded,
  onToggle,
}: {
  audit: Audit
  expanded: boolean
  onToggle: () => void
}) {
  const tier = scoreTier(audit.score)
  const tierStyle = TIER_STYLE[tier]

  return (
    <div
      className={clsx(
        'bg-white rounded-lg border border-slate-200 overflow-hidden transition-all',
        expanded && `ring-2 ${tierStyle.ring}`
      )}
    >
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
      >
        {/* Score badge */}
        <div
          className={clsx(
            'w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0',
            tierStyle.bg,
            tierStyle.color
          )}
        >
          {audit.score}
        </div>

        {/* Business name + category */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900 truncate">{audit.businessName}</p>
            {audit.usedTavily && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                <Sparkles className="w-3 h-3" /> Tavily
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{audit.categoryName}</p>
        </div>

        {/* Contact icons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {audit.foundEmail ? (
            <span title="Email found" className="text-purple-600">
              <Mail className="w-4 h-4" />
            </span>
          ) : (
            <span title="No email" className="text-slate-300">
              <Mail className="w-4 h-4" />
            </span>
          )}
          {audit.foundPhone ? (
            <span title="Phone found" className="text-emerald-600">
              <Phone className="w-4 h-4" />
            </span>
          ) : (
            <span title="No phone" className="text-slate-300">
              <Phone className="w-4 h-4" />
            </span>
          )}
          {audit.hasSsl ? (
            <span title="SSL" className="text-blue-600">
              <Shield className="w-4 h-4" />
            </span>
          ) : (
            <span title="No SSL" className="text-red-400">
              <Shield className="w-4 h-4" />
            </span>
          )}
        </div>

        {/* Status */}
        <div className="text-xs text-slate-500 flex-shrink-0 hidden md:block">
          {audit.httpStatus && (
            <span
              className={clsx(
                'font-mono',
                audit.httpStatus >= 200 && audit.httpStatus < 300
                  ? 'text-emerald-600'
                  : audit.httpStatus === 0
                    ? 'text-slate-400'
                    : 'text-amber-600'
              )}
            >
              {audit.httpStatus}
            </span>
          )}
        </div>
      </button>

      {expanded && <AuditDetail audit={audit} />}
    </div>
  )
}

function AuditDetail({ audit }: { audit: Audit }) {
  const checks = [
    { label: 'SSL', ok: audit.hasSsl },
    { label: 'Mobile-friendly', ok: audit.isMobileFriendly },
    { label: 'Title tag', ok: audit.hasTitle },
    { label: 'Meta description', ok: audit.hasMetaDescription },
    { label: 'Single H1', ok: audit.hasSingleH1 },
    { label: 'Sitemap', ok: audit.hasSitemap },
    { label: 'robots.txt', ok: audit.hasRobotsTxt },
    { label: 'Schema.org', ok: audit.hasSchemaOrg },
    { label: 'Open Graph', ok: audit.hasOpenGraph },
    { label: 'Alt text coverage', ok: audit.hasAltTextCoverage },
    { label: 'Contact form', ok: audit.hasContactForm },
    { label: 'Visible email', ok: audit.hasVisibleEmail },
    { label: 'Google Analytics', ok: audit.hasGoogleAnalytics },
    { label: 'Google Tag Manager', ok: audit.hasGoogleTagManager },
    { label: 'Meta Pixel', ok: audit.hasMetaPixel },
    { label: 'Has blog', ok: audit.hasBlog },
    { label: 'No deprecated HTML', ok: !audit.hasDeprecatedHtml },
  ]

  const passing = checks.filter((c) => c.ok).length

  return (
    <div className="border-t border-slate-100 px-4 py-4 bg-slate-50">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact info */}
        <div className="space-y-2 text-sm">
          <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
            Contact Found
          </h4>
          {audit.foundEmail ? (
            <a
              href={`mailto:${audit.foundEmail}`}
              className="flex items-center gap-2 text-purple-700 hover:underline"
            >
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{audit.foundEmail}</span>
            </a>
          ) : (
            <p className="text-slate-400 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> No email found
            </p>
          )}
          {audit.foundPhone ? (
            <a
              href={`tel:${audit.foundPhone}`}
              className="flex items-center gap-2 text-emerald-700 hover:underline"
            >
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
              {audit.foundPhone}
            </a>
          ) : (
            <p className="text-slate-400 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" /> No phone found
            </p>
          )}
          {audit.businessWebsite && (
            <a
              href={audit.businessWebsite}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 text-blue-700 hover:underline"
            >
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{audit.businessWebsite}</span>
            </a>
          )}
          <a
            href={`/business/${audit.businessSlug}`}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 text-slate-700 hover:text-[#007a7f] text-xs"
          >
            <ExternalLink className="w-3 h-3" />
            View live listing
          </a>
        </div>

        {/* Audit checks */}
        <div className="md:col-span-2">
          <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-2">
            Audit Checks ({passing}/{checks.length} passing)
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            {checks.map((c) => (
              <div
                key={c.label}
                className={clsx(
                  'flex items-center gap-2 text-xs px-2 py-1 rounded',
                  c.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                )}
              >
                {c.ok ? (
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3 h-3 flex-shrink-0" />
                )}
                {c.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metadata footer */}
      <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
        {audit.pageLoadMs && (
          <span>
            Loaded in <span className="font-mono">{audit.pageLoadMs}ms</span>
          </span>
        )}
        {audit.contentLength && (
          <span>
            <span className="font-mono">{Math.round(audit.contentLength / 1024)}KB</span>
          </span>
        )}
        {audit.copyrightYear && (
          <span>
            © <span className="font-mono">{audit.copyrightYear}</span>
          </span>
        )}
        {audit.fallbackReason && (
          <span className="text-amber-700">⚠️ {audit.fallbackReason}</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {new Date(audit.auditedAt).toLocaleString()}
        </span>
      </div>
    </div>
  )
}