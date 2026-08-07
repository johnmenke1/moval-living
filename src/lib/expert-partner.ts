/**
 * Expert Partner helpers — Moreno Valley Expert Partner program
 *
 * Architecture (Aug 2026, revised after GHL API probe):
 *   1. POST /businesses/ — creates the partner Company (idempotent via
 *      name-match search). Accepts only: locationId, name, email, phone,
 *      website. Does NOT accept: tags, externalId.
 *   2. POST /contacts/ — creates the lead Contact with tags +
 *      customFields. Does NOT accept companyId.
 *   3. PUT /contacts/{id} — sets businessId (camelCase) on the Contact,
 *      linking it to the Company. This is the documented pattern in the
 *      GHL marketplace docs.
 *
 * Idempotency strategy: search by `name` (case-sensitive exact match),
 * reuse the existing Company ID if found, otherwise create. The name is
 * stable for a given Expert Partner (it's their Business.name from
 * moval.living). We cache the GHL companyId on Business.ghlCompanyId so
 * we skip even the search after the first lead.
 *
 * Tag strategy: tags on Companies can't be set via API. The Expert
 * Partner workflow filter MUST target the Contact's Company (via
 * businessId) OR be set up at the workflow level with a different filter
 * (e.g., pipeline stage). See ghl-setup-step-by-step.md for the
 * current workaround.
 *
 * Authentication: Private Integration token (`pit-...`). The
 * `businesses.write` scope is REQUIRED for POST /businesses/ — without
 * it, you get 422 "Unprocessable Entity" on every field.
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

// GHL API endpoints we call (verified Aug 2026 via probe):
//   GET    /businesses/                — list all companies (used to search by name)
//   POST   /businesses/                — create company. Accepts: locationId, name,
//                                         email, phone, website. Rejects: tags, externalId.
//   POST   /contacts/                  — create contact. Accepts: tags, customFields.
//                                         Rejects: companyId.
//   PUT    /contacts/{id}              — update contact. Accepts: businessId (sets
//                                         the Contact's Company association).
//   GET    /contacts/{id}              — verify contact.
//   POST   /opportunities/             — create opportunity.
//   POST   /workflows/{id}/enroll      — enroll contact in workflow.
//
// Authentication: Private Integration token (`pit-...`) with scope
// businesses.write. Standard Location API keys 422 on POST /businesses/.

interface BusinessContext {
  businessId: string
  businessName: string
  expertPartnerSlug: string | null
  businessEmail?: string | null
  businessPhone?: string | null
  businessWebsite?: string | null
  cachedGhlCompanyId?: string | null
}

interface CachedCompany {
  ok: boolean
  companyId?: string
  error?: string
}

/**
 * Find or create the partner's Company record in GHL.
 *
 * Idempotency: searches GHL for an existing Company with the exact name
 * within this location. If found, reuses its ID. If not, creates.
 * Cached companyId on our Business row skips the search.
 */
async function findOrCreatePartnerCompany(
  apiKey: string,
  locationId: string,
  ctx: BusinessContext
): Promise<CachedCompany> {
  // Fast path: use cached ID
  if (ctx.cachedGhlCompanyId) {
    return { ok: true, companyId: ctx.cachedGhlCompanyId }
  }

  // Search for an existing Company with the same name in this location
  try {
    const listRes = await fetch(
      `${GHL_API_BASE}/businesses/?locationId=${encodeURIComponent(locationId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: GHL_API_VERSION,
        },
      }
    )
    if (listRes.ok) {
      const list = await listRes.json()
      const existing = (list.businesses || []).find(
        (b: { name: string }) => b.name === ctx.businessName
      )
      if (existing?.id) {
        return { ok: true, companyId: existing.id }
      }
    }
  } catch (e) {
    // Search failed — fall through to create
    console.error('[GHL] Company search failed:', e)
  }

  // Create
  const createRes = await fetch(`${GHL_API_BASE}/businesses/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: GHL_API_VERSION,
    },
    body: JSON.stringify({
      locationId,
      name: ctx.businessName,
      email: ctx.businessEmail || undefined,
      phone: ctx.businessPhone || undefined,
      website: ctx.businessWebsite || undefined,
    }),
  })

  if (!createRes.ok) {
    const text = await createRes.text()
    return {
      ok: false,
      error: `GHL company create failed: ${createRes.status} ${text.slice(0, 200)}`,
    }
  }

  const json = await createRes.json()
  const companyId: string | undefined = json.business?.id || json.id
  return { ok: true, companyId }
}

/**
 * Create the lead Contact, then link it to the Company via PUT.
 * The PUT-with-businessId pattern is what actually associates the
 * Contact with the Company in GHL.
 */
async function createAndLinkContact(
  apiKey: string,
  locationId: string,
  lead: ExpertPartnerLead,
  companyId: string,
  partnerSlug: string | null
): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  // Step 1: create contact
  const createRes = await fetch(`${GHL_API_BASE}/contacts/`, {
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
      customFields: [
        { key: 'movalliving_lead_id', field_value: lead.id },
        { key: 'lead_message', field_value: lead.message.slice(0, 500) },
        { key: 'partner_slug', field_value: partnerSlug ?? '' },
      ],
    }),
  })

  if (!createRes.ok) {
    const text = await createRes.text()
    return {
      ok: false,
      error: `GHL contact create failed: ${createRes.status} ${text.slice(0, 200)}`,
    }
  }

  const created = await createRes.json()
  const contactId: string = created.contact?.id || created.id

  // Step 2: link to Company via PUT businessId
  const linkRes = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: GHL_API_VERSION,
    },
    body: JSON.stringify({ businessId: companyId }),
  })

  if (!linkRes.ok) {
    // Non-fatal — the Contact was created, just not linked. Workflow
    // filtering by Company won't work for this lead.
    console.error(
      `[GHL] Contact ${contactId} created but PUT businessId failed:`,
      linkRes.status,
      await linkRes.text().then((t) => t.slice(0, 200))
    )
  }

  return { ok: true, contactId }
}

/**
 * Forwards a lead to GoHighLevel.
 *
 * Returns `{ ok: true, contactId, companyId }` on success.
 * Returns `{ ok: false, skipped: true, reason }` if env vars are missing.
 * Returns `{ ok: false, error }` on actual API failure.
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
    // 1. Find or create the partner's Company
    const company = await findOrCreatePartnerCompany(apiKey, locationId, businessContext)
    if (!company.ok || !company.companyId) {
      return {
        ok: false,
        skipped: false,
        error: company.error || 'Company find/create failed',
      }
    }

    // 2. Create the lead Contact and link it to the Company
    const contactResult = await createAndLinkContact(
      apiKey,
      locationId,
      lead,
      company.companyId,
      businessContext.expertPartnerSlug
    )
    if (!contactResult.ok || !contactResult.contactId) {
      return {
        ok: false,
        skipped: false,
        error: contactResult.error || 'Contact create failed',
      }
    }
    const contactId = contactResult.contactId

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