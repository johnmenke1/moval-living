'use client'

import { useState } from 'react'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Activity,
  Mail,
  CreditCard,
  Zap,
  Database,
} from 'lucide-react'
import { clsx } from 'clsx'

interface Result {
  ok: boolean
  status: 'idle' | 'loading' | 'success' | 'error' | 'warning'
  message: string
  details?: Record<string, unknown>
  ranAt?: string
}

/**
 * DiagnosticsPanel — admin-only ops surface.
 *
 * One-click checks for:
 *   - Database connectivity (counts + recent record timestamp)
 *   - SES Mail Manager SMTP auth
 *   - Stripe price IDs (all 4 valid?)
 *   - GHL API connectivity
 *
 * Calls /api/admin/diagnostics/* endpoints (each is admin-gated server-side).
 * Saves the last 5 results so you can spot flapping after a deploy.
 */

export default function DiagnosticsPanel() {
  const [db, setDb] = useState<Result>({ ok: false, status: 'idle', message: '' })
  const [ses, setSes] = useState<Result>({ ok: false, status: 'idle', message: '' })
  const [stripe, setStripe] = useState<Result>({ ok: false, status: 'idle', message: '' })
  const [ghl, setGhl] = useState<Result>({ ok: false, status: 'idle', message: '' })

  async function runCheck(
    setter: (r: Result) => void,
    endpoint: string,
    label: string
  ) {
    setter({ ok: false, status: 'loading', message: `Checking ${label}…` })
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()
      const ok = res.ok && (data.ok ?? data.allValid ?? data.valid)
      setter({
        ok,
        status: ok ? 'success' : 'error',
        message: data.message || data.error || (ok ? `${label} OK` : `${label} failed`),
        details: data,
        ranAt: new Date().toISOString(),
      })
    } catch (err) {
      setter({
        ok: false,
        status: 'error',
        message: err instanceof Error ? err.message : 'Network error',
        ranAt: new Date().toISOString(),
      })
    }
  }

  function runAll() {
    runCheck(setDb, '/api/admin/diagnostics/db', 'database')
    runCheck(setSes, '/api/admin/diagnostics/ses', 'SES SMTP')
    runCheck(setStripe, '/api/admin/diagnostics/stripe-prices', 'Stripe prices')
    runCheck(setGhl, '/api/admin/diagnostics/ghl', 'GHL')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Diagnostics</h2>
          <p className="text-sm text-slate-600 mt-1">
            One-click health checks for the integrations that make Expert Partner work.
          </p>
        </div>
        <button
          onClick={runAll}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#007a7f] text-white text-sm font-semibold hover:bg-[#00405c] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Run all checks
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CheckCard
          icon={Database}
          title="Database"
          description="Neon Postgres connectivity + record counts"
          result={db}
          onRun={() => runCheck(setDb, '/api/admin/diagnostics/db', 'database')}
        />
        <CheckCard
          icon={Mail}
          title="Email (SES Mail Manager)"
          description="AWS SMTP auth + credential format check"
          result={ses}
          onRun={() => runCheck(setSes, '/api/admin/diagnostics/ses', 'SES SMTP')}
        />
        <CheckCard
          icon={CreditCard}
          title="Stripe Prices"
          description="All 4 price IDs valid in current Stripe account"
          result={stripe}
          onRun={() => runCheck(setStripe, '/api/admin/diagnostics/stripe-prices', 'Stripe prices')}
        />
        <CheckCard
          icon={Zap}
          title="GoHighLevel"
          description="API token + location/pipeline/stage resolution"
          result={ghl}
          onRun={() => runCheck(setGhl, '/api/admin/diagnostics/ghl', 'GHL')}
        />
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">If a check fails:</p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800">
              <li>Click the card to see the full diagnostic details</li>
              <li>For missing env vars: check Vercel → Settings → Environment Variables</li>
              <li>For SES 535 errors: rotate SMTP password on the AWS Mail Manager ingress endpoint</li>
              <li>For &ldquo;No such price&rdquo;: re-create the product in the current Stripe account and paste the new price ID into Vercel</li>
              <li>For GHL: verify Private Integration token still has Companies + Contacts scopes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckCard({
  icon: Icon,
  title,
  description,
  result,
  onRun,
}: {
  icon: typeof Activity
  title: string
  description: string
  result: Result
  onRun: () => void
}) {
  const statusColor =
    result.status === 'loading'
      ? 'text-blue-600 bg-blue-50'
      : result.status === 'success'
        ? 'text-emerald-600 bg-emerald-50'
        : result.status === 'error'
          ? 'text-red-600 bg-red-50'
          : 'text-slate-400 bg-slate-50'

  const StatusIcon =
    result.status === 'loading'
      ? Loader2
      : result.status === 'success'
        ? CheckCircle2
        : result.status === 'error'
          ? XCircle
          : Activity

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-600 mt-0.5">{description}</p>
          </div>
        </div>
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', statusColor)}>
          <StatusIcon className={clsx('w-4 h-4', result.status === 'loading' && 'animate-spin')} />
        </div>
      </div>

      {result.message && (
        <p
          className={clsx(
            'text-sm mb-3',
            result.ok ? 'text-emerald-700' : result.status === 'error' ? 'text-red-700' : 'text-slate-700'
          )}
        >
          {result.message}
        </p>
      )}

      {result.ranAt && (
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">
          Last checked {new Date(result.ranAt).toLocaleTimeString()}
        </p>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-semibold">
          {result.details ? 'View raw response' : 'Run to see details'}
        </summary>
        {result.details && (
          <pre className="mt-2 bg-slate-900 text-slate-100 p-3 rounded text-[10px] overflow-x-auto max-h-64 leading-relaxed">
            {JSON.stringify(result.details, null, 2)}
          </pre>
        )}
      </details>

      <button
        onClick={onRun}
        disabled={result.status === 'loading'}
        className="mt-3 w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        {result.status === 'loading' ? 'Checking…' : 'Run check'}
      </button>
    </div>
  )
}