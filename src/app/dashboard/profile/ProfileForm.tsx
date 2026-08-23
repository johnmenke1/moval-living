'use client'

/**
 * ProfileForm — client component for /dashboard/profile.
 *
 * Sections:
 *   1. Avatar upload (multipart to /api/profile/avatar)
 *   2. Display name (PATCH to /api/profile)
 *   3. Email opt-in (CAN-SPAM — same PATCH)
 *   4. SMS opt-in (TCPA — same PATCH, only if phone exists in future)
 *
 * The form auto-saves on blur for opt-in toggles but requires explicit
 * Save for the name field — names are sticky in share cards, so we want
 * users to be intentional.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Camera, Loader2, Check, AlertCircle, User as UserIcon,
} from 'lucide-react'
import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_MAX_BYTES,
  profileSchema,
} from './profile-helpers'

interface ProfileFormProps {
  initialName: string
  initialImage: string | null
  initialEmailOptIn: boolean
  initialSmsOptIn: boolean
  email: string
  emailVerified: boolean
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function avatarGradient(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  const hue = ((hash % 360) + 360) % 360
  const complement = (hue + 35) % 360
  return [`hsl(${hue}, 65%, 45%)`, `hsl(${complement}, 60%, 35%)`]
}

export function ProfileForm({
  initialName,
  initialImage,
  initialEmailOptIn,
  initialSmsOptIn,
  email,
  emailVerified,
}: ProfileFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(initialName)
  const [image, setImage] = useState<string | null>(initialImage)
  const [emailOptIn, setEmailOptIn] = useState(initialEmailOptIn)
  const [smsOptIn, setSmsOptIn] = useState(initialSmsOptIn)

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [nameTouched, setNameTouched] = useState(false)
  const [, startTransition] = useTransition()

  // Live-validate the name as the user types (after they've touched it)
  const nameValidation = (() => {
    if (!nameTouched) return null
    const parsed = profileSchema.safeParse({ name })
    if (parsed.success) return null
    return parsed.error.issues[0]?.message ?? 'Invalid name'
  })()

  async function handleSaveName() {
    setError(null)
    setSuccess(null)
    const parsed = profileSchema.safeParse({ name })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid name')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: parsed.data.name }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not save your name')
      }
      setSuccess('Name saved')
      setTimeout(() => setSuccess(null), 2000)
      // Refresh the server tree so the dashboard header avatar/name
      // reflects the change immediately.
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleOptIn(
    field: 'emailOptIn' | 'smsOptIn',
    value: boolean,
  ) {
    setError(null)
    setSuccess(null)
    if (field === 'emailOptIn') setEmailOptIn(value)
    if (field === 'smsOptIn') setSmsOptIn(value)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, [field]: value }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Could not save preference')
      }
      setSuccess('Preference saved')
      setTimeout(() => setSuccess(null), 2000)
    } catch (e) {
      // Revert on error
      if (field === 'emailOptIn') setEmailOptIn(!value)
      if (field === 'smsOptIn') setSmsOptIn(!value)
      setError(e instanceof Error ? e.message : 'Could not save preference')
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > AVATAR_MAX_BYTES) {
      setError('Image is too large (max 5MB)')
      e.target.value = ''
      return
    }
    if (
      !AVATAR_ALLOWED_TYPES.includes(
        file.type as typeof AVATAR_ALLOWED_TYPES[number],
      )
    ) {
      setError('Use a JPEG, PNG, WEBP, or GIF image')
      e.target.value = ''
      return
    }

    setError(null)
    setSuccess(null)
    setUploading(true)

    // Local preview so the user sees the change immediately
    const localUrl = URL.createObjectURL(file)
    setImage(localUrl)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // Revert local preview
        setImage(initialImage)
        throw new Error(body.error ?? 'Could not upload avatar')
      }
      const data = await res.json()
      // Replace the local preview with the persisted URL
      setImage(data.url)
      setSuccess('Avatar updated')
      setTimeout(() => setSuccess(null), 2000)
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload')
    } finally {
      setUploading(false)
      // Revoke the local blob URL — the persisted URL has replaced it
      URL.revokeObjectURL(localUrl)
      e.target.value = ''
    }
  }

  const [gradFrom, gradTo] = avatarGradient(name || 'MoVal member')

  return (
    <div className="space-y-6">
      {/* Status banners */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* ── Avatar ─────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-text mb-1">Profile photo</h2>
        <p className="text-xs text-text-secondary mb-4">
          Shown on your Best Of MoVal share cards and in the voter feed.
        </p>
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-full ring-2 ring-slate-100 flex items-center justify-center text-lg font-bold text-white overflow-hidden flex-shrink-0"
            style={{
              background: image
                ? undefined
                : `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
            }}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={name || 'Profile'}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{initials(name || 'MoVal member') || <UserIcon className="w-8 h-8" />}</span>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 bg-white border border-slate-200 text-text font-medium text-sm px-3 py-2 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-60 disabled:cursor-wait transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              {uploading ? 'Uploading…' : 'Change photo'}
            </button>
            <p className="text-xs text-text-secondary mt-2">
              JPEG, PNG, WEBP, or GIF. Max 5MB.
            </p>
          </div>
        </div>
      </section>

      {/* ── Display name ───────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-text mb-1">Display name</h2>
        <p className="text-xs text-text-secondary mb-4">
          Appears as &quot;{name || 'Sarah K.'} voted for…&quot; on share cards. Letters,
          spaces, hyphens, apostrophes, dots, and commas only.
        </p>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              maxLength={120}
              placeholder="Sarah K."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              aria-invalid={Boolean(nameValidation)}
              aria-describedby={nameValidation ? 'name-error' : undefined}
            />
            {nameValidation && (
              <p id="name-error" className="text-xs text-red-600 mt-1">
                {nameValidation}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSaveName}
            disabled={saving || Boolean(nameValidation) || name === initialName}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-[#007a7f] to-[#00405c] text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </section>

      {/* ── Email (read-only, with verification status) ─────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-text mb-1">Email</h2>
        <div className="flex items-center gap-2 mt-3">
          <code className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm flex-1 truncate">
            {email}
          </code>
          {emailVerified ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              <Check className="w-3 h-3" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" />
              Not verified
            </span>
          )}
        </div>
      </section>

      {/* ── Communication preferences ──────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-text mb-1">Email preferences</h2>
        <p className="text-xs text-text-secondary mb-4">
          We&apos;ll only email when you&apos;ve opted in. Unsubscribe anytime.
        </p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={emailOptIn}
            onChange={(e) => handleToggleOptIn('emailOptIn', e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-text">
            Send me a recap when Best Of MoVal voting opens and a heads-up
            about new guides in my favorite categories.
          </span>
        </label>

        <hr className="my-4 border-slate-100" />

        <h2 className="text-sm font-bold text-text mb-1">SMS preferences</h2>
        <p className="text-xs text-text-secondary mb-4">
          SMS isn&apos;t enabled on your account yet — we&apos;ll need a phone number
          before this can take effect.
        </p>
        <label className="flex items-start gap-3 cursor-not-allowed opacity-60">
          <input
            type="checkbox"
            checked={smsOptIn}
            disabled
            className="mt-1"
          />
          <span className="text-sm text-text">
            Text me about… (coming soon)
          </span>
        </label>
      </section>

      {/* ── Snapshot warning ──────────────────────────────────────── */}
      <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-amber-900 mb-1">
          A note about your existing votes
        </h2>
        <p className="text-xs text-amber-900/80">
          Your name and photo on share cards for votes you&apos;ve already cast
          won&apos;t change when you update them here — we captured them at vote
          time. Future votes will use your new name and photo.
        </p>
      </section>
    </div>
  )
}
