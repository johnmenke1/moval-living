/**
 * Profile helpers — pure functions for /dashboard/profile validation
 * and avatar-URL handling. Extracted so unit tests can import them
 * without pulling React + NextAuth client libs.
 */

import { describe, expect, it } from 'vitest'
import {
  profileSchema,
  buildAvatarPath,
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_TYPES,
} from './profile-helpers'

describe('profileSchema', () => {
  it('accepts a name + email-opt-in update', () => {
    const parsed = profileSchema.parse({
      name: 'Sarah K.',
      emailOptIn: true,
    })
    expect(parsed.name).toBe('Sarah K.')
    expect(parsed.emailOptIn).toBe(true)
  })

  it('trims whitespace from the name', () => {
    const parsed = profileSchema.parse({ name: '  Sarah K.  ' })
    expect(parsed.name).toBe('Sarah K.')
  })

  it('defaults emailOptIn to false', () => {
    const parsed = profileSchema.parse({ name: 'Sarah' })
    expect(parsed.emailOptIn).toBe(false)
  })

  it('rejects empty names', () => {
    expect(() => profileSchema.parse({ name: '' })).toThrow()
    expect(() => profileSchema.parse({ name: '   ' })).toThrow()
  })

  it('rejects names longer than 120 chars', () => {
    expect(() => profileSchema.parse({ name: 'a'.repeat(121) })).toThrow()
  })

  it('rejects names that look like emails or URLs (XSS-safe display)', () => {
    expect(() =>
      profileSchema.parse({ name: '<script>alert(1)</script>' }),
    ).toThrow()
    expect(() =>
      profileSchema.parse({ name: 'http://evil.example.com' }),
    ).toThrow()
    expect(() => profileSchema.parse({ name: 'foo@bar.com' })).toThrow()
  })

  it('accepts names with hyphens, apostrophes, accents, and dots', () => {
    const parsed = profileSchema.parse({ name: "Sean O'Connor-Mendez" })
    expect(parsed.name).toBe("Sean O'Connor-Mendez")
    const parsed2 = profileSchema.parse({ name: 'José García' })
    expect(parsed2.name).toBe('José García')
  })
})

describe('buildAvatarPath', () => {
  it('builds a stable per-user path with timestamp + ext', () => {
    const path = buildAvatarPath('owner_123', 'image/png')
    expect(path).toMatch(/^owners\/owner_123\/avatar-\d+\.png$/)
  })

  it('normalizes JPEG mime types to .jpg', () => {
    const path = buildAvatarPath('owner_x', 'image/JPEG')
    expect(path).toMatch(/^owners\/owner_x\/avatar-\d+\.jpg$/)
  })

  it('falls back to .jpg for unknown mime types', () => {
    const path = buildAvatarPath('owner_y', 'application/octet-stream')
    expect(path).toMatch(/\.jpg$/)
  })
})

describe('AVATAR constants', () => {
  it('caps avatar uploads at 5MB (smaller than 10MB admin upload)', () => {
    expect(AVATAR_MAX_BYTES).toBe(5 * 1024 * 1024)
  })

  it('permits only common raster avatar formats', () => {
    expect(AVATAR_ALLOWED_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ])
  })
})
