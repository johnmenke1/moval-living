/**
 * Expert Partner helpers — Moreno Valley Expert Partner program
 *
 * Single source of truth for:
 *   - Slug generation for /partners/[slug]
 *   - Partner display data (label, accent color, badge tier)
 *   - GoHighLevel lead forwarding (Companies endpoint + Private Integration token)
 *
 * Architecture (Aug 2026): we use the **Companies** endpoint
 * (POST /businesses/) and link Contacts → Company via companyId. This
 * requires a Private Integration token (`pit-...`) with elevated scope
 * for businesses — a standard Location API key returns 401 on that
 * endpoint. Confirmed via n8n community thread (Aug 2026).
 *
 * Flow:
 *   1. When a Business becomes an Expert Partner, we upsert a Company
 *      record in GHL via POST /businesses/ (idempotent by externalId).
 *      Save the returned GHL companyId on our Business row as
 *      `ghlCompanyId` so subsequent leads skip the upsert.
 *   2. When a lead comes in via the form, we create a Contact with
 *      `companyId` pointing to the partner's Company record.
 *   3. Workflows filter on Contact's Company or on the Company tag —
 *      much cleaner than filtering on a Contact custom field.
 *
 * The "Partner = GHL sub-account" model still applies at the LOCATION
 * level (one sub-account per partner business in v2), but the Companies
 * object is how we organize things WITHIN that sub-account.
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

// ───────────────────────────────────────────────────────────────────────────
// GoHighLevel — Companies + Contacts via Private Integration token
// ───────────────────────────────────────────────────────────────────────────

export interface GhlForwardResult {
  ok: boolean
  skipped: boolean
  reason?: string
  contactId?: string
  companyId?: string
  error?: string
}

export const GHL_API_BASE = 'https://services.leadconnectorhq.com'
export const GHL_API_VERSION = '2021-07-28'

// GHL API endpoints we call:
//   GET    /businesses/?locationId=X&externalId=Y    — find company by externalId
//   POST   /businesses/                             — create or upsert company
//   POST   /contacts/                               — create contact with companyId
//   POST   /opportunities/                          — create opportunity
//   POST   /workflows/{id}/enroll                   — enroll contact in workflow
//
// Authentication: Private Integration token (`pit-...`) with scopes:
//   businesses.readonly, businesses.write,
//   contacts.readonly, contacts.write,
//   opportunities.readonly, opportunities.write,
//   workflows.readonly, workflows.write

interface BusinessContext {
  businessId: string
  businessName: string
  expertPartnerSlug: string | null
  cachedGhlCompanyId?: string | null
}

/**
 * Upsert the partner's Company record in GHL. Idempotent — uses our
 * `movalliving_business_id` as the externalId so re-running won't
 * duplicate. If we already cached the GHL companyId on our Business
 * row, we skip the lookup entirely.
 */
async function upsertPartnerCompany(
  apiKey: string,
  locationId: string,
  ctx: BusinessContext
): Promise<{ ok: boolean; companyId?: string; error?: string }> {
  if (ctx.cachedGhlCompanyId) {
    return { ok: true, companyId: ctx.cachedGhlCompanyId }
  }

  // Try to create. With externalId populated and the private integration
  // scope, GHL either creates or returns the existing company that
  // matches externalId — idempotent.
  const res = await fetch(`${GHL_API_BASE}/businesses/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: GHL_API_VERSION,
    },
    body: JSON.stringify({
      locationId,
      name: ctx.businessName,
      externalId: ctx.businessId,
      slug: ctx.expertPartnerSlug || undefined,
      tags: ['expert-partner'],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return {
      ok: false,
      error: `GHL company create failed: ${res.status} ${text.slice(0, 200)}`,
    }
  }

  const json = await res.json()
  const companyId: string | undefined = json.business?.id || json.id
  return { ok: true, companyId }
}

/**
 * Forwards a lead to GoHighLevel.
 *
 * Returns `{ ok: true, contactId, companyId }` on success.
 * Returns `{ ok: false, skipped: true, reason }` if env vars are missing
 * (the lead is still saved to our DB and emailed via SES regardless).
 * Returns `{ ok: false, error }` on actual API failure.
 *
 * v2 extension point: when Business has its own ghlLocationId, fetch the
 * business first and override locationId/apiKey from those fields.
 */
export async function forwardToGHL(
  lead: ExpertPartnerLead,
  businessContext: BusinessContext
): Promise<GhlForwardResult> {
  const apiKey = process.env.GHL_API_KEY
  const locationId = process.env.GHL_LOCATION_ID
  const pipelineId = process.env.GHL_PIPELINE_ID
  const pipelineStageId = process.env.GHL_PIPELINE_STAGE_ID
  const workflowId = process.env.GHL_WORKFLOW_ID

  if (!apiKey || !locationId) {
    return {
      ok: false,
      skipped: true,
      reason: 'GHL_API_KEY or GHL_LOCATION_ID env var not set — lead saved locally only',
    }
  }

  try {
    // 1. Upsert the partner's Company record
    const company = await upsertPartnerCompany(apiKey, locationId, businessContext)
    if (!company.ok || !company.companyId) {
      return {
        ok: false,
        skipped: false,
        error: company.error || 'Company upsert failed',
      }
    }

    // 2. Create the lead Contact, linked to the Company
    const contactRes = await fetch(`${GHL_API_BASE}/contacts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: GHL_API_VERSION,
      },
      body: JSON.stringify({
        locationId,
        firstName: lead.name.split(' ')[0] || lead.name,
        lastName: lead.name.split(' ').slice(1).join(' ') || '',
        email: lead.email,
        phone: lead.phone || undefined,
        source: 'movalliving.com/partners',
        tags: ['movalliving-lead'],
        companyId: company.companyId,
        customFields: [
          { key: 'movalliving_lead_id', field_value: lead.id },
          { key: 'lead_message', field_value: lead.message.slice(0, 500) },
          { key: 'partner_slug', field_value: businessContext.expertPartnerSlug ?? '' },
        ],
      }),
    })

    if (!contactRes.ok) {
      const text = await contactRes.text()
      return {
        ok: false,
        skipped: false,
        error: `GHL contact create failed: ${contactRes.status} ${text.slice(0, 200)}`,
      }
    }

    const contact = await contactRes.json()
    const contactId: string = contact.contact?.id || contact.id

    // 3. Add to pipeline (if configured)
    if (pipelineId && pipelineStageId) {
      await fetch(`${GHL_API_BASE}/opportunities/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Version: GHL_API_VERSION,
        },
        body: JSON.stringify({
          locationId,
          contactId,
          pipelineId,
          pipelineStageId,
          name: `Lead — ${lead.name} (${businessContext.businessName})`,
          status: 'open',
          source: 'movalliving.com/partners',
        }),
      }).catch((e) => {
        // Non-fatal — contact was created; pipeline add failed
        console.error('[GHL] Pipeline add failed:', e)
      })
    }

    // 4. Enroll in workflow (if configured)
    if (workflowId) {
      await fetch(`${GHL_API_BASE}/workflows/${workflowId}/enroll`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Version: GHL_API_VERSION,
        },
        body: JSON.stringify({ contactId, locationId }),
      }).catch((e) => {
        console.error('[GHL] Workflow enroll failed:', e)
      })
    }

    return { ok: true, skipped: false, contactId, companyId: company.companyId }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown GHL error'
    console.error('[GHL] forwardToGHL failed:', error)
    return { ok: false, skipped: false, error }
  }
}