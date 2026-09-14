'use client'

import { useState } from 'react'
import { Plus, Pencil, Tag, Calendar, Sparkles, X } from 'lucide-react'
import { DealForm, DealFormValues } from './DealForm'

// Shared "Deals" panel for both the owner /dashboard/deals page AND the
// admin Deals tab inside /dashboard/edit?id=... . Same component,
// different guards upstream — this file only deals with the list and
// the add/edit form, not auth (the parent page ensures the caller may
// manage the business via canManageBusiness).
//
// Layout:
//   - Header: business name + "Add a new deal" button (toggles form)
//   - Add form (collapsible, only one at a time — opening the new-deal
//     form collapses any open edit form)
//   - List of existing deals, each with an Edit toggle that swaps in
//     the inline edit form

export interface DealRow {
  id: string
  headline: string
  description: string | null
  code: string | null
  imageUrl: string | null
  startsAt: string | Date | null
  expiresAt: string | Date | null
  displayOrder: number
  isActive: boolean
  createdAt: string | Date
  updatedAt: string | Date
}

interface Props {
  businessId: string
  businessName: string
  deals: DealRow[]
  /** Optional helper text shown above the list — e.g. admin sees
   *  "Editing on behalf of <business>", owner sees nothing. */
  contextLabel?: string
}

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function DealsManager({ businessId, businessName, deals, contextLabel }: Props) {
  // Track which form is open: 'new' | dealId | null. Only one at a time.
  const [openForm, setOpenForm] = useState<'new' | string | null>(null)

  // Stable sort: active first, then by displayOrder ASC, then newest.
  const sorted = [...deals].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const openNew = () => setOpenForm(openForm === 'new' ? null : 'new')
  const openEdit = (id: string) => setOpenForm(openForm === id ? null : id)
  const closeForm = () => setOpenForm(null)

  return (
    <div className="space-y-4">
      {contextLabel && (
        <p className="text-sm text-text-secondary bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg">
          {contextLabel}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text">Deals</h2>
          <p className="text-sm text-text-secondary">
            {deals.length === 0
              ? `No deals yet for ${businessName}. Add the first one below.`
              : `${deals.length} deal${deals.length !== 1 ? 's' : ''} on ${businessName}`}
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="btn-primary"
        >
          {openForm === 'new' ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {openForm === 'new' ? 'Cancel' : 'Add deal'}
        </button>
      </div>

      {openForm === 'new' && (
        <DealForm
          businessId={businessId}
          onDone={closeForm}
          onCancel={closeForm}
        />
      )}

      {sorted.length === 0 && openForm !== 'new' ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
          <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-text-secondary">
            Click <strong>Add deal</strong> to create the first one.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map(deal => {
            const isEditing = openForm === deal.id
            const expiresLabel = formatDate(deal.expiresAt)
            const startsLabel = formatDate(deal.startsAt)

            return (
              <li key={deal.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {isEditing ? (
                  <div className="p-4">
                    <DealForm
                      businessId={businessId}
                      deal={deal as DealFormValues}
                      onDone={closeForm}
                      onCancel={closeForm}
                    />
                  </div>
                ) : (
                  <div className="p-5 flex items-start gap-4">
                    {deal.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={deal.imageUrl}
                        alt={deal.headline}
                        className="w-20 h-20 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                        <Tag className="w-6 h-6 text-slate-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-text truncate">{deal.headline}</h3>
                        <button
                          type="button"
                          onClick={() => openEdit(deal.id)}
                          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary transition-colors flex-shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </div>
                      {deal.description && (
                        <p className="text-sm text-text-secondary line-clamp-2 mt-1">{deal.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {deal.code && (
                          <span className="inline-flex items-center gap-1 text-xs font-mono bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            <Sparkles className="w-3 h-3 text-accent" />
                            {deal.code}
                          </span>
                        )}
                        {expiresLabel && (
                          <span className="inline-flex items-center gap-1 text-xs text-text-secondary bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            <Calendar className="w-3 h-3" />
                            {startsLabel ? `${startsLabel} – ${expiresLabel}` : `Ends ${expiresLabel}`}
                          </span>
                        )}
                        {!deal.isActive && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
