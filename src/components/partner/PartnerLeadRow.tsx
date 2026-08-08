'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Circle, Mail, Phone, Loader2, Save } from 'lucide-react'

interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  message: string
  contacted: boolean
  contactedAt: Date | null
  notes: string | null
  createdAt: Date
  ghlSyncedAt: Date | null
}

/**
 * PartnerLeadRow — one row in the partner's lead inbox.
 *
 * Owner-only. Two inline actions:
 *   1. Mark contacted (one-click toggle, optimistic UI)
 *   2. Save private notes (debounced save via /api/partners/leads/:id)
 *
 * No real-time sync needed — partners check in when they want to.
 * The lead stays in their inbox until they mark it contacted.
 */
export function PartnerLeadRow({ lead }: { lead: Lead }) {
  const [contacted, setContacted] = useState(lead.contacted)
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [savedNotes, setSavedNotes] = useState(false)
  const [pending, startTransition] = useTransition()

  async function toggleContacted() {
    const next = !contacted
    setContacted(next)
    startTransition(async () => {
      const res = await fetch(`/api/partners/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacted: next }),
      })
      if (!res.ok) {
        setContacted(!next) // revert
      }
    })
  }

  async function saveNotes() {
    setSavingNotes(true)
    setSavedNotes(false)
    const res = await fetch(`/api/partners/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    setSavingNotes(false)
    if (res.ok) {
      setSavedNotes(true)
      setTimeout(() => setSavedNotes(false), 2000)
    }
  }

  return (
    <article className="bg-white rounded-xl border border-slate-200 p-5">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-slate-900">{lead.name}</h3>
            {contacted ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle className="w-3 h-3" /> Contacted
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                <Circle className="w-3 h-3" /> New
              </span>
            )}
            {lead.ghlSyncedAt && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                GHL synced
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {new Date(lead.createdAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            {lead.contactedAt && contacted && (
              <span className="ml-2 text-emerald-600">
                · Contacted{' '}
                {new Date(lead.contactedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={toggleContacted}
          disabled={pending}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {pending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : contacted ? (
            <Circle className="w-3 h-3" />
          ) : (
            <CheckCircle className="w-3 h-3" />
          )}
          {contacted ? 'Mark new' : 'Mark contacted'}
        </button>
      </header>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-3">
        <a
          href={`mailto:${lead.email}`}
          className="flex items-center gap-1.5 text-[#007a7f] hover:underline"
        >
          <Mail className="w-3.5 h-3.5" />
          {lead.email}
        </a>
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center gap-1.5 text-[#007a7f] hover:underline"
          >
            <Phone className="w-3.5 h-3.5" />
            {lead.phone}
          </a>
        )}
      </div>

      <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap mb-3">
        {lead.message}
      </div>

      <details className="group">
        <summary className="text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none">
          Private notes {notes && '· ' + notes.length + ' chars'}
        </summary>
        <div className="mt-2 flex gap-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Only you can see these notes. Add call reminders, follow-up dates, etc."
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-[#007a7f]/30 focus:border-[#007a7f]"
          />
          <button
            onClick={saveNotes}
            disabled={savingNotes}
            className="px-3 py-2 rounded-lg bg-[#007a7f] text-white text-sm font-semibold hover:bg-[#00405c] transition-colors disabled:opacity-50 flex items-center gap-1.5 self-start"
          >
            {savingNotes ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : savedNotes ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {savingNotes ? 'Saving' : savedNotes ? 'Saved' : 'Save'}
          </button>
        </div>
      </details>
    </article>
  )
}