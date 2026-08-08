import { describe, expect, it, vi } from 'vitest'

// Mock the prisma module before importing the functions that use it.
// `vi.mock` is hoisted by Vitest, so we declare the mock here and
// each test configures its return value via mockReturnValueOnce.
vi.mock('./prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from './prisma'
import {
  slugifyExpertPartner,
  ensureUniqueExpertPartnerSlug,
  getPartnerDisplay,
} from './expert-partner'

/**
 * Pure-function tests for expert-partner.ts. We test the deterministic
 * helpers (slug generation, partner display) and the slug-uniqueness
 * loop (which only depends on Prisma's findUnique).
 *
 * The HTTP-based forwardToGHL() is exercised by live smoke tests in
 * docs/ghl-verification-checklist.md because it requires a real PIT
 * token — mocking fetch would be misleading.
 */

describe('slugifyExpertPartner', () => {
  it('lowercases, hyphenates, and strips non-URL-safe characters', () => {
    // The current implementation treats all non-alphanumerics (incl. ')
    // as separators. That produces "john-s-plumbing-heating" — not pretty
    // but it's URL-safe and predictable. If we ever want to preserve
    // contractions, the slugifier would need to special-case them.
    expect(slugifyExpertPartner("John's Plumbing & Heating!")).toBe('john-s-plumbing-heating')
  })

  it('collapses repeated separators and trims edges', () => {
    expect(slugifyExpertPartner('  Big  Bob   BBQ  ')).toBe('big-bob-bbq')
  })

  it('preserves hyphens inside words but rejects at edges', () => {
    expect(slugifyExpertPartner('-already-clean-')).toBe('already-clean')
  })

  it('returns empty string when nothing survives sanitization', () => {
    expect(slugifyExpertPartner('!!!')).toBe('')
    expect(slugifyExpertPartner('   ')).toBe('')
  })

  it('truncates to 120 characters max', () => {
    const longName = 'a'.repeat(200)
    expect(slugifyExpertPartner(longName).length).toBe(120)
  })
})

describe('ensureUniqueExpertPartnerSlug', () => {
  it('returns the base slug when nothing has it', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce(null)
    const result = await ensureUniqueExpertPartnerSlug('menke-realty')
    expect(result).toBe('menke-realty')
  })

  it('skips a slug held by the excluded business (editing keeps slug)', async () => {
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce({
      id: 'self',
    } as never)
    const result = await ensureUniqueExpertPartnerSlug('menke-realty', 'self')
    expect(result).toBe('menke-realty')
  })

  it('appends -2 on first conflict', async () => {
    // First call: base taken by someone else
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce({ id: 'other' } as never)
    // Second call: menke-realty-2 is free
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce(null)
    const result = await ensureUniqueExpertPartnerSlug('menke-realty')
    expect(result).toBe('menke-realty-2')
  })

  it('walks through -2, -3 until finding a free one', async () => {
    // Base taken
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce({ id: 'a' } as never)
    // -2 taken
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce({ id: 'b' } as never)
    // -3 free
    vi.mocked(prisma.business.findUnique).mockResolvedValueOnce(null)
    const result = await ensureUniqueExpertPartnerSlug('menke-realty')
    expect(result).toBe('menke-realty-3')
  })

  it('throws when input is all special characters', async () => {
    await expect(ensureUniqueExpertPartnerSlug('!!!')).rejects.toThrow(
      'Could not generate a slug'
    )
  })
})

describe('getPartnerDisplay', () => {
  it('returns null for non-partners', () => {
    const result = getPartnerDisplay({
      isExpertPartner: false,
      foundingPartnerSince: null,
    })
    expect(result).toBeNull()
  })

  it('returns STANDARD tier for Expert Partners without founding date', () => {
    const result = getPartnerDisplay({
      isExpertPartner: true,
      foundingPartnerSince: null,
    })
    expect(result?.tier).toBe('STANDARD')
    expect(result?.showFoundingPartner).toBe(false)
    expect(result?.badgeLabel).toBe('★ Expert Partner')
  })

  it('returns FOUNDING tier when foundingPartnerSince is set', () => {
    const result = getPartnerDisplay({
      isExpertPartner: true,
      foundingPartnerSince: new Date('2026-01-01'),
    })
    expect(result?.tier).toBe('FOUNDING')
    expect(result?.showFoundingPartner).toBe(true)
    expect(result?.badgeLabel).toBe('★ Founding Expert Partner')
  })

  it('ignores foundingPartnerSince when isExpertPartner is false', () => {
    const result = getPartnerDisplay({
      isExpertPartner: false,
      foundingPartnerSince: new Date('2026-01-01'),
    })
    expect(result).toBeNull()
  })
})