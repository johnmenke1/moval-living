'use client'

import Link from 'next/link'
import { Building2, Mail, ExternalLink, Inbox } from 'lucide-react'
import type { ClaimedBusinessRow } from '@/lib/admin-claimed-businesses'

interface ClaimedBusinessesListProps {
  businesses: ClaimedBusinessRow[]
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Read-only table view of every claimed business.
 *
 * Columns: Business (name + category) | Claimed (date + relative age) |
 * Owner (name + email link) | Action (link to admin edit page).
 *
 * Email is rendered as a mailto: so admins can reach out without
 * copy-pasting. The action link uses the existing /dashboard/edit
 * admin-override shape (?id=<businessId>) verified 2026-09-15.
 *
 * Empty state mirrors the rest of the admin dashboard's empty-state
 * language ("no claimed businesses yet") rather than a generic
 * "no results."
 */
export default function ClaimedBusinessesList({ businesses }: ClaimedBusinessesListProps) {
  if (businesses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
        <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-text mb-1">No claimed businesses yet</h3>
        <p className="text-sm text-text-secondary">
          When a business owner completes the claim flow, they&rsquo;ll show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-left text-text-secondary uppercase text-xs tracking-wider">
              <th className="px-5 py-3 font-semibold">Business</th>
              <th className="px-5 py-3 font-semibold">Claimed</th>
              <th className="px-5 py-3 font-semibold">Owner</th>
              <th className="px-5 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {businesses.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold text-text">{b.name.trim()}</div>
                      {b.category && (
                        <div className="text-xs text-text-secondary">{b.category.name}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-text-secondary whitespace-nowrap">
                  {formatDate(b.claimedAt)}
                </td>
                <td className="px-5 py-4">
                  <div className="font-medium text-text">{b.owner?.name || '—'}</div>
                  <a
                    href={`mailto:${b.owner?.email}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Mail className="w-3 h-3" />
                    {b.owner?.email}
                  </a>
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/dashboard/edit?id=${b.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Edit <ExternalLink className="w-3 h-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards (same data, stacked) */}
      <div className="md:hidden divide-y divide-slate-100">
        {businesses.map((b) => (
          <div key={b.id} className="p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="font-bold text-text">{b.name.trim()}</div>
                {b.category && (
                  <div className="text-xs text-text-secondary">{b.category.name}</div>
                )}
              </div>
              <Link
                href={`/dashboard/edit?id=${b.id}`}
                className="text-xs font-semibold text-primary hover:underline shrink-0"
              >
                Edit
              </Link>
            </div>
            <div className="text-xs text-text-secondary mb-1">
              Claimed {formatDate(b.claimedAt)}
            </div>
            <div className="text-xs">
              <div className="font-medium text-text">{b.owner?.name || '—'}</div>
              <a
                href={`mailto:${b.owner?.email}`}
                className="text-primary hover:underline"
              >
                {b.owner?.email}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
