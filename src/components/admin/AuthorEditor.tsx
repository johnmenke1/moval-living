'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, ExternalLink } from 'lucide-react'

interface AuthorInitial {
  id: string
  slug: string
  displayName: string
  title: string | null
  bio: string
  photoUrl: string | null
  personalSiteUrl: string | null
  companyName: string | null
  companyUrl: string | null
  linkedinUrl: string | null
  twitterUrl: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  businessId: string | null
  isActive: boolean
}

type Props =
  | { mode: 'create'; initial?: undefined }
  | { mode: 'edit'; initial: AuthorInitial }

export default function AuthorEditor(props: Props) {
  const router = useRouter()
  const isEdit = props.mode === 'edit'
  const initial = isEdit ? props.initial : null

  const [form, setForm] = useState({
    slug: initial?.slug ?? '',
    displayName: initial?.displayName ?? '',
    title: initial?.title ?? '',
    bio: initial?.bio ?? '',
    photoUrl: initial?.photoUrl ?? '',
    personalSiteUrl: initial?.personalSiteUrl ?? '',
    companyName: initial?.companyName ?? '',
    companyUrl: initial?.companyUrl ?? '',
    linkedinUrl: initial?.linkedinUrl ?? '',
    twitterUrl: initial?.twitterUrl ?? '',
    facebookUrl: initial?.facebookUrl ?? '',
    instagramUrl: initial?.instagramUrl ?? '',
    isActive: initial?.isActive ?? true,
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (isEdit) {
        const res = await fetch(`/api/admin/authors/${initial!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Save failed')
        }
        router.push('/dashboard/authors')
        router.refresh()
      } else {
        const res = await fetch('/api/admin/authors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Create failed')
        }
        const data = await res.json()
        router.push(`/dashboard/authors/${data.slug}`)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Identity */}
      <Section title="Identity">
        <Field label="Display name" required>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setField('displayName', e.target.value)}
            required
            className="input"
          />
        </Field>
        <Field label="Title" hint='e.g. "Realtor, Leeper Realty Group"'>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Slug" hint="URL component. Auto-derived from name if blank.">
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setField('slug', e.target.value)}
            placeholder="chris-leeper"
            className="input font-mono text-sm"
          />
        </Field>
        <Field label="Bio" required hint="2-3 sentences. Markdown ok.">
          <textarea
            value={form.bio}
            onChange={(e) => setField('bio', e.target.value)}
            required
            rows={5}
            className="input"
          />
        </Field>
        {isEdit && (
          <Field label="Active">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField('isActive', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">
                Show author page and list this author publicly
              </span>
            </label>
          </Field>
        )}
      </Section>

      {/* Photo */}
      <Section title="Photo">
        <Field label="Photo URL" hint="Paste a hosted image URL or upload to /api/upload first.">
          <input
            type="url"
            value={form.photoUrl}
            onChange={(e) => setField('photoUrl', e.target.value)}
            placeholder="https://..."
            className="input"
          />
        </Field>
        {form.photoUrl && (
          <div className="mt-3">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.photoUrl}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            </div>
          </div>
        )}
      </Section>

      {/* Web presence */}
      <Section title="Web presence">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Personal site">
            <input
              type="url"
              value={form.personalSiteUrl}
              onChange={(e) => setField('personalSiteUrl', e.target.value)}
              placeholder="https://..."
              className="input"
            />
          </Field>
          <Field label="Company name">
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => setField('companyName', e.target.value)}
              placeholder="Leeper Realty Group"
              className="input"
            />
          </Field>
          <Field label="Company URL">
            <input
              type="url"
              value={form.companyUrl}
              onChange={(e) => setField('companyUrl', e.target.value)}
              placeholder="https://leeperrealty.com"
              className="input"
            />
          </Field>
          <Field label="LinkedIn">
            <input
              type="url"
              value={form.linkedinUrl}
              onChange={(e) => setField('linkedinUrl', e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className="input"
            />
          </Field>
          <Field label="Twitter / X">
            <input
              type="url"
              value={form.twitterUrl}
              onChange={(e) => setField('twitterUrl', e.target.value)}
              placeholder="https://x.com/..."
              className="input"
            />
          </Field>
          <Field label="Facebook">
            <input
              type="url"
              value={form.facebookUrl}
              onChange={(e) => setField('facebookUrl', e.target.value)}
              placeholder="https://facebook.com/..."
              className="input"
            />
          </Field>
          <Field label="Instagram">
            <input
              type="url"
              value={form.instagramUrl}
              onChange={(e) => setField('instagramUrl', e.target.value)}
              placeholder="https://instagram.com/..."
              className="input"
            />
          </Field>
        </div>
      </Section>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        {isEdit ? (
          <a
            href={`/authors/${form.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary"
          >
            <ExternalLink className="w-4 h-4" />
            View public page
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
              {isEdit ? 'Save Changes' : 'Create Author'}
            </>
          )}
        </button>
      </div>

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
    </form>
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