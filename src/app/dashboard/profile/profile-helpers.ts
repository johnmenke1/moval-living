/**
 * Profile helpers — pure functions for /dashboard/profile validation
 * and avatar-URL handling. Lives outside the page component so unit
 * tests can import without pulling React + NextAuth client libs.
 */

import { z } from 'zod'

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024 // 5MB (smaller than the 10MB admin upload)
export const AVATAR_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

/**
 * Display name rules:
 * - Required (voter share cards need a non-empty name)
 * - 1-120 chars after trim
 * - Unicode letters + spaces + safe punctuation (- ' . ,)
 * - Reject anything containing < > : ; / \ ? @ ( ) [ ] { } = + — those
 *   characters can be used to impersonate a link, email, or shell-style
 *   markup. XSS isn't possible (we render as text), but we don't want a
 *   voter setting their display name to "Click https://evil.com" and
 *   have it look like a legitimate URL in a share-card preview.
 */
const NAME_REGEX = /^[\p{L}\p{M}\p{Zs}'.,\-,]+$/u

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tell us what to call you')
    .max(120, 'Name is too long')
    .regex(
      NAME_REGEX,
      'Use letters, spaces, hyphens, apostrophes, dots, and commas only',
    ),
  emailOptIn: z.boolean().optional().default(false),
})

export type ProfileInput = z.infer<typeof profileSchema>

/**
 * Build a stable per-user avatar path under Vercel Blob. We use the
 * ownerId as the path segment so each user's avatars are co-located
 * and easy to clean up if we ever need to (delete prefix).
 */
export function buildAvatarPath(
  ownerId: string,
  mimeType: string,
): string {
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  const ext = extMap[mimeType.toLowerCase()] ?? 'jpg'
  return `owners/${ownerId}/avatar-${Date.now()}.${ext}`
}
