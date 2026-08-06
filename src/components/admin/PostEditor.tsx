'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save,
  Loader2,
  ExternalLink,
  Send,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react'

interface Author {
  id: string
  slug: string
  displayName: string
  photoUrl: string | null
}

interface PostInitial {
  id: string
  slug: string
  title: string
  excerpt: string
  body: string
  heroImageUrl: string | null
  status: string
  scheduledFor: string | null
  publishedAt: string | null
  rejectionReason: string | null
  editorNotes: string | null
  metaTitle: string | null
  metaDescription: string | null
  authorId: string
  author: Author
}

type Props =
  | { mode: 'create'; authors: Author[]; initial?: undefined }
  | { mode: 'edit'; authors: Author[]; initial: PostInitial }

export default function PostEditor(props: Props) {
  const router = useRouter()
  const isEdit = props.mode === 'edit'
  const initial = isEdit ? props.initial : null

  const [form, setForm] = useState({
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    excerpt: initial?.excerpt ?? '',
    body: initial?.body ?? '',
    heroImageUrl: initial?.heroImageUrl ?? '',
    authorId: initial?.authorId ?? (props.authors[0]?.id ?? ''),
    metaTitle: initial?.metaTitle ?? '',
    metaDescription: initial?.metaDescription ?? '',
    editorNotes: initial?.editorNotes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Auto-derive slug from title when blank (create mode only)
  useEffect(() => {
    if (!isEdit && form.title && !form.slug) {
      setForm((prev) => ({ ...prev, slug: slugify(form.title) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title])

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (isEdit) {
        const res = await fetch(`/api/admin/posts/${initial!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Save failed')
        }
        router.refresh()
      } else {
        const res = await fetch('/api/admin/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Create failed')
        }
        const data = await res.json()
        router.push(`/dashboard/posts-queue/${data.slug}`)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function transition(status: string, opts?: { scheduledFor?: string; rejectionReason?: string }) {
    if (!initial) return
    setTransitioning(status)
    setError('')
    try {
      const res = await fetch(`/api/admin/posts/${initial.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...opts }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || 'Transition failed')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed')
    } finally {
      setTransitioning(null)
    }
  }

  const status = initial?.status ?? 'draft'

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identity */}
        <Section title="Content">
          <Field label="Title" required>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="Slug" hint="Auto-derived from title. Edit for SEO.">
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setField('slug', e.target.value)}
              placeholder="is-now-the-right-time-to-buy-in-moreno-valley"
              className="input font-mono text-sm"
            />
          </Field>
          <Field label="Author" required>
            <select
              value={form.authorId}
              onChange={(e) => setField('authorId', e.target.value)}
              required
              disabled={isEdit}
              className="input"
            >
              <option value="">— select author —</option>
              {props.authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
            {isEdit && (
              <span className="block text-xs text-text-secondary mt-1">
                Author can&apos;t be changed after creation.
              </span>
            )}
          </Field>
          <Field label="Excerpt" required hint="1-2 sentences. Used in cards and meta description fallback.">
            <textarea
              value={form.excerpt}
              onChange={(e) => setField('excerpt', e.target.value)}
              required
              rows={3}
              className="input"
            />
          </Field>
          <Field label="Body" required hint="Markdown. Rendered on /insights/[slug].">
            <textarea
              value={form.body}
              onChange={(e) => setField('body', e.target.value)}
              required
              rows={20}
              className="input font-mono text-sm"
            />
          </Field>
          <Field label="Hero image URL" hint="Paste a hosted image URL.">
            <input
              type="url"
              value={form.heroImageUrl}
              onChange={(e) => setField('heroImageUrl', e.target.value)}
              placeholder="https://..."
              className="input"
            />
          </Field>
        </Section>

        {/* SEO */}
        <Section title="SEO">
          <Field label="Meta title" hint="Optional. Falls back to title.">
            <input
              type="text"
              value={form.metaTitle}
              onChange={(e) => setField('metaTitle', e.target.value)}
              maxLength={200}
              className="input"
            />
          </Field>
          <Field label="Meta description" hint="Optional. Falls back to excerpt.">
            <textarea
              value={form.metaDescription}
              onChange={(e) => setField('metaDescription', e.target.value)}
              rows={2}
              maxLength={320}
              className="input"
            />
          </Field>
        </Section>

        {/* Editor notes — visible only to Johnny */}
        {isEdit && (
          <Section title="Editor notes (private)">
            <Field label="Notes" hint="Only visible to admins. Not shown on the public page.">
              <textarea
                value={form.editorNotes}
                onChange={(e) => setField('editorNotes', e.target.value)}
                rows={4}
                className="input"
                placeholder="e.g. tighten the second graf; fact-check the rate quote"
              />
            </Field>
          </Section>
        )}

        {/* Save */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          {isEdit ? (
            <a
              href={`/insights/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary"
            >
              <ExternalLink className="w-4 h-4" />
              Preview public URL
            </a>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'Save Changes' : 'Save Draft'}
              </>
            )}
          </button>
        </div>
      </form>

      {/* Workflow actions — only on edit mode */}
      {isEdit && (
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-3">
            Workflow
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            Current status: <strong>{status.replace('_', ' ')}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            {status === 'draft' && (
              <WorkflowButton
                onClick={() => transition('submitted')}
                loading={transitioning === 'submitted'}
                icon={<Send className="w-4 h-4" />}
                label="Submit for review"
                color="amber"
              />
            )}
            {status === 'submitted' && (
              <WorkflowButton
                onClick={() => transition('in_review')}
                loading={transitioning === 'in_review'}
                icon={<Send className="w-4 h-4" />}
                label="Start review"
                color="blue"
              />
            )}
            {(status === 'submitted' || status === 'in_review' || status === 'scheduled') && (
              <>
                <WorkflowButton
                  onClick={() => {
                    if (initial && confirm(`Publish "${initial.title}" now? It will go live immediately at /insights/${initial.slug}.`)) {
                      transition('published')
                    }
                  }}
                  loading={transitioning === 'published'}
                  icon={<CheckCircle className="w-4 h-4" />}
                  label="Publish now"
                  color="green"
                />
                <WorkflowButton
                  onClick={() => {
                    const when = prompt('Schedule for (ISO datetime, e.g. 2026-08-15T09:00:00Z):')
                    if (when) transition('scheduled', { scheduledFor: when })
                  }}
                  loading={transitioning === 'scheduled'}
                  icon={<Calendar className="w-4 h-4" />}
                  label="Schedule"
                  color="purple"
                />
                <WorkflowButton
                  onClick={() => {
                    const reason = prompt('Reason for rejection (private to you):')
                    if (reason) transition('rejected', { rejectionReason: reason })
                  }}
                  loading={transitioning === 'rejected'}
                  icon={<XCircle className="w-4 h-4" />}
                  label="Reject"
                  color="red"
                />
              </>
            )}
            {status === 'published' && (
              <WorkflowButton
                onClick={() => {
                  if (confirm('Unpublish this post? It will return to draft.')) {
                    transition('draft')
                  }
                }}
                loading={transitioning === 'draft'}
                icon={<XCircle className="w-4 h-4" />}
                label="Unpublish"
                color="slate"
              />
            )}
            {status === 'rejected' && (
              <WorkflowButton
                onClick={() => transition('draft')}
                loading={transitioning === 'draft'}
                icon={<Send className="w-4 h-4" />}
                label="Move back to draft"
                color="amber"
              />
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }
        :global(.input:focus) {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 2px rgb(0 122 127 / 0.15);
        }
      `}</style>
    </div>
  )
}

function WorkflowButton({
  onClick,
  loading,
  icon,
  label,
  color,
}: {
  onClick: () => void
  loading: boolean
  icon: React.ReactNode
  label: string
  color: 'amber' | 'blue' | 'green' | 'purple' | 'red' | 'slate'
}) {
  const colorClasses: Record<typeof color, string> = {
    amber: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
    blue: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    green: 'bg-green-100 text-green-800 hover:bg-green-200',
    purple: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
    red: 'bg-red-100 text-red-800 hover:bg-red-200',
    slate: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`text-sm px-3 py-2 rounded-md font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 ${colorClasses[color]}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text uppercase tracking-wide border-b border-slate-100 pb-2">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
  required,
  hint,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
  hint?: string
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text mb-1">
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </span>
      {children}
      {hint && (
        <span className="block text-xs text-text-secondary mt-1">{hint}</span>
      )}
    </label>
  )
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}