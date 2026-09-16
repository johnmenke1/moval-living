/**
 * Expert Partner helpers — Moreno Valley Expert Partner program.
 *
 * Responsibilities (after GoHighLevel cancellation, 2026-09-15):
 *   - Slug helpers (slugifyExpertPartner, ensureUniqueExpertPartnerSlug)
 *   - Display helpers (PartnerTier, PartnerDisplay, getPartnerDisplay)
 *   - Category-exclusivity check (isCategoryOpenForPartner)
 *
 * Lead forwarding to GHL was previously handled here via `forwardToGHL()`.
 * That function and all its GHL-specific helpers were removed when the GHL
 * account was cancelled — partner-leads now save locally and notify the
 * partner via SES only. (See src/app/api/partners/[slug]/leads/route.ts.)
 */

import { prisma } from './prisma'
import type { ExpertPartnerLead } from '@prisma/client'

// ───────────────────────────────────────────────────────────────────────────
// Slug helpers
// ───────────────────────────────────────────────────────────────────────────

export function slugifyExpertPartner(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

export async function ensureUniqueExpertPartnerSlug(
  desired: string,
  excludeBusinessId?: string
): Promise<string> {
  const base = slugifyExpertPartner(desired)
  if (!base) throw new Error('Could not generate a slug from input')

  const existing = await prisma.business.findUnique({
    where: { expertPartnerSlug: base },
    select: { id: true },
  })
  if (!existing || existing.id === excludeBusinessId) {
    return base
  }

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`
    const conflict = await prisma.business.findUnique({
      where: { expertPartnerSlug: candidate },
      select: { id: true },
    })
    if (!conflict || conflict.id === excludeBusinessId) {
      return candidate
    }
  }
  throw new Error('Could not generate a unique Expert Partner slug')
}

// ───────────────────────────────────────────────────────────────────────────
// Display helpers
// ───────────────────────────────────────────────────────────────────────────

export type PartnerTier = 'FOUNDING' | 'STANDARD'

export interface PartnerDisplay {
  tier: PartnerTier
  badgeLabel: string
  badgeColorClass: string
  showFoundingPartner: boolean
}

export function getPartnerDisplay(business: {
  isExpertPartner: boolean
  foundingPartnerSince: Date | null
}): PartnerDisplay | null {
  if (!business.isExpertPartner) return null
  const isFounding = !!business.foundingPartnerSince
  return {
    tier: isFounding ? 'FOUNDING' : 'STANDARD',
    badgeLabel: isFounding ? '★ Founding Expert Partner' : '★ Expert Partner',
    badgeColorClass: isFounding
      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 border-amber-600'
      : 'bg-gradient-to-r from-[#007a7f] to-[#00405c] text-white border-[#00405c]',
    showFoundingPartner: isFounding,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Category exclusivity check
// ───────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the category has zero active Expert Partners (i.e. the
 * slot is open). Used by /partners to render "Available" vs "Claimed"
 * status badges next to each category.
 */
export async function isCategoryOpenForPartner(categoryId: string): Promise<boolean> {
  const count = await prisma.business.count({
    where: {
      isExpertPartner: true,
      categoryId,
      status: 'APPROVED',
    },
  })
  return count === 0
}
