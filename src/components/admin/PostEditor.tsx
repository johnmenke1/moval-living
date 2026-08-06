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
import MarkdownEditor from '@/components/admin/MarkdownEditor'

interface Author {
  id: string
  slug: string
  displayName: string
  photoUrl: string | null
}

interface PostInitial {
  id: string
  slug: string
  postType: 'LIFE' | 'GUEST' | 'OUTING' | 'SPOTLIGHT'
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
  authorId: string | null
  author: Author | null
  // LIFE
  spotifyTrack1: string | null
  spotifyTrack2: string | null
  // GUEST
  faqItems: { question: string; answer: string }[]
  // OUTING
  outingPhotos: { url: string; caption?: string }[] 
  youtubeVideoId: string | null
}

type Props =
  | { mode: 'create'; authors: Author[]; initial?: undefined }
  | { mode: 'edit'; authors: Author[]; initial: PostInitial }

const POST_TYPE_OPTIONS: { value: PostInitial['postType']; label: string }[] = [
  { value: 'LIFE', label: 'Life in MoVal — John\'s editorial voice' },
  { value: 'GUEST', label: 'Guest Expert — curated local contributor' },
  { value: 'OUTING', label: 'Live Curiously — photo-essay outing' },
  { value: 'SPOTLIGHT', label: 'Business Spotlight — video short' },
]

export default function PostEditor(props: Props) {
  const router = useRouter()
  const isEdit = props.mode === 'edit'
  const initial = isEdit ? props.initial : null

  const [form, setForm] = useState({
    postType: initial?.postType ?? 'GUEST',
    title: initial?.title ?? '',
    slug: initial?.slug ?? '',
    excerpt: initial?.excerpt ?? '',
    body: initial?.body ?? '',
    heroImageUrl: initial?.heroImageUrl ?? '',
    authorId: initial?.authorId ?? (props.authors[0]?.id ?? ''),
    metaTitle: initial?.metaTitle ?? '',
    metaDescription: initial?.metaDescription ?? '',
    editorNotes: initial?.editorNotes ?? '',
    // LIFE
    spotifyTrack1: initial?.spotifyTrack1 ?? '',
    spotifyTrack2: initial?.spotifyTrack2 ?? '',
    // GUEST FAQ
    faqItems: initial?.faqItems ?? [],
    // OUTING / SPOTLIGHT
    outingPhotos: initial?.outingPhotos ?? [],
    youtubeVideoId: initial?.youtubeVideoId ?? '',
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
          <Field label="Post type" required>
            <select
              value={form.postType}
              onChange={(e) => setField('postType', e.target.value as typeof form.postType)}
              required
              disabled={isEdit}
              className="input"
            >
              {POST_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {isEdit && (
              <span className="block text-xs text-text-secondary mt-1">
                Post type can&apos;t be changed after creation.
              </span>
            )}
          </Field>
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
          {form.postType === 'GUEST' && (
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
          )}
          <Field label="Excerpt" required hint="1-2 sentences. Used in cards and meta description fallback.">
            <textarea
              value={form.excerpt}
              onChange={(e) => setField('excerpt', e.target.value)}
              required
              rows={3}
              className="input"
            />
          </Field>
          <Field label="Body" required hint="Markdown supported. Toolbar above the editor; paste formatted text to auto-convert.">
            <MarkdownEditor
              value={form.body}
              onChange={(v) => setField('body', v)}
              minRows={20}
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
          {form.postType === 'LIFE' && (
            <Field label="What I'm listening to" hint="Spotify track IDs — find them in the track's Share → Copy Spotify URI (e.g. 4PTG3Z6ehGkBFwjybzWkR8).">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Track 1</label>
                  <input
                    type="text"
                    value={form.spotifyTrack1}
                    onChange={(e) => setField('spotifyTrack1', e.target.value)}
                    placeholder="4PTG3Z6ehGkBFwjybzWkR8"
                    className="input font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text mb-1">Track 2</label>
                  <input
                    type="text"
                    value={form.spotifyTrack2}
                    onChange={(e) => setField('spotifyTrack2', e.target.value)}
                    placeholder="4PTG3Z6ehGkBFwjybzWkR8"
                    className="input font-mono text-sm"
                  />
                </div>
              </div>
            </Field>
          )}

          {/* GUEST: FAQ editor */}
          {form.postType === 'GUEST' && (
            <Field label="FAQ items" hint="Optional. Each Q&amp;A becomes a FAQSchema.org entry on the page.">
              <div className="space-y-3">
                {form.faqItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start bg-slate-50 rounded-lg p-3">
                    <span className="text-xs font-medium text-slate-400 mt-6 w-4">{i + 1}.</span>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-text mb-1">Question</label>
                        <input
                          type="text"
                          value={item.question}
                          onChange={(e) => {
                            const updated = [...form.faqItems]
                            updated[i] = { ...updated[i], question: e.target.value }
                            setField('faqItems', updated)
                          }}
                          placeholder="What is..."
                          className="input text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text mb-1">Answer</label>
                        <input
                          type="text"
                          value={item.answer}
                          onChange={(e) => {
                            const updated = [...form.faqItems]
                            updated[i] = { ...updated[i], answer: e.target.value }
                            setField('faqItems', updated)
                          }}
                          placeholder="It is..."
                          className="input text-sm"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setField('faqItems', form.faqItems.filter((_, j) => j !== i))}
                      className="mt-5 text-slate-400 hover:text-red-500 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setField('faqItems', [...form.faqItems, { question: '', answer: '' }])}
                  className="text-sm text-primary hover:underline"
                >
                  + Add FAQ item
                </button>
              </div>
            </Field>
          )}

          {/* OUTING: photo gallery */}
          {form.postType === 'OUTING' && (
            <Field label="Trip photo gallery" hint="Optional. Each photo gets its own caption below it.">
              <div className="space-y-3">
                {form.outingPhotos.map((photo, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <input
                        type="url"
                        value={photo.url}
                        onChange={(e) => {
                          const updated = [...form.outingPhotos]
                          updated[i] = { ...updated[i], url: e.target.value }
                          setField('outingPhotos', updated)
                        }}
                        placeholder="https://..."
                        className="input text-sm font-mono flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setField('outingPhotos', form.outingPhotos.filter((_, j) => j !== i))}
                        className="text-slate-400 hover:text-red-500 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      value={photo.caption ?? ''}
                      onChange={(e) => {
                        const updated = [...form.outingPhotos]
                        updated[i] = { ...updated[i], caption: e.target.value }
                        setField('outingPhotos', updated)
                      }}
                      placeholder="Caption (optional)"
                      maxLength={280}
                      className="input text-sm w-full"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setField('outingPhotos', [...form.outingPhotos, { url: '', caption: '' }])}
                  className="text-sm text-primary hover:underline"
                >
                  + Add photo
                </button>
              </div>
            </Field>
          )}

          {/* OUTING & SPOTLIGHT: YouTube video */}
          {(form.postType === 'OUTING' || form.postType === 'SPOTLIGHT') && (
            <Field label="YouTube video" hint="YouTube video ID — the part after ?v= in the URL (e.g. dQw4w9WgXcQ).">
              <input
                type="text"
                value={form.youtubeVideoId}
                onChange={(e) => setField('youtubeVideoId', e.target.value)}
                placeholder="dQw4w9WgXcQ"
                className="input font-mono text-sm"
              />
            </Field>
          )}
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
              href={`/${postTypeUrl(form.postType)}/${form.slug}`}
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

function postTypeUrl(postType: string): string {
  switch (postType) {
    case 'LIFE':      return '/life'
    case 'GUEST':     return '/insights'
    case 'OUTING':    return '/outings'
    case 'SPOTLIGHT': return '/spotlights'
    default:          return '/insights'
  }
}