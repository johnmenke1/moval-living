import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { forwardToGHL } from '@/lib/expert-partner'

/**
 * POST /api/admin/partners/[businessId]/test-ghl
 *
 * Admin-only endpoint. Fires a SYNTHETIC lead through the full GHL
 * forwardToGHL pipeline so Johnny can verify the integration end-to-end
 * without going through the public form. Returns what happened at each
 * step so the admin UI can show a useful toast.
 *
 * The synthetic lead is NOT saved to our DB and NOT emailed to the
 * partner — it's a fire-and-forget probe. Safe to spam.
 *
 * Note: requires the business to be flagged as Expert Partner
 * (isExpertPartner: true) and have an expertPartnerSlug set, just like
 * the real flow.
 */

interface TestResult {
  step: string
  ok: boolean
  detail: string
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { businessId } = await params

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      website: true,
      slug: true,
      expertPartnerSlug: true,
      ghlCompanyId: true,
      isExpertPartner: true,
    },
  })

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  if (!business.isExpertPartner) {
    return NextResponse.json(
      {
        error:
          'Business is not flagged as an Expert Partner. Set tier to "Expert Partner ✨" in admin first.',
      },
      { status: 400 }
    )
  }

  const results: TestResult[] = []

  // Pre-check env vars
  const envCheck = {
    apiKey: !!process.env.GHL_API_KEY,
    locationId: !!process.env.GHL_LOCATION_ID,
    pipelineId: !!process.env.GHL_PIPELINE_ID,
    stageId: !!process.env.GHL_PIPELINE_STAGE_ID,
    workflowId: !!process.env.GHL_WORKFLOW_ID,
  }
  results.push({
    step: 'env_vars',
    ok: Object.values(envCheck).every(Boolean),
    detail: JSON.stringify(envCheck),
  })

  // Synthetic lead — clearly marked so it's obvious in GHL
  const timestamp = Date.now()
  const syntheticLead = {
    id: `test-${timestamp}`,
    businessId: business.id,
    name: `Test Lead ${new Date(timestamp).toISOString().slice(11, 19)}`,
    email: `test-${timestamp}@movalliving-test.invalid`,
    phone: null,
    message: 'This is a synthetic test lead fired from the admin panel — safe to delete in GHL.',
    sourceIp: null,
    userAgent: 'admin-test-endpoint',
    contacted: false,
    contactedAt: null,
    notes: null,
    ghlContactId: null,
    ghlSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Parameters<typeof forwardToGHL>[0]

  // Fire the GHL pipeline
  const ghlResult = await forwardToGHL(syntheticLead, {
    businessId: business.id,
    businessName: business.name,
    expertPartnerSlug: business.expertPartnerSlug,
    businessEmail: business.email,
    businessPhone: business.phone,
    businessWebsite: business.website,
    cachedGhlCompanyId: business.ghlCompanyId,
  })

  results.push({
    step: 'ghl_forward',
    ok: ghlResult.ok,
    detail: ghlResult.ok
      ? `Contact created: ${ghlResult.contactId}, Company: ${ghlResult.companyId}`
      : ghlResult.skipped
        ? `Skipped — ${ghlResult.reason}`
        : `Error — ${ghlResult.error}`,
  })

  // If we got a new companyId and we don't have one cached, cache it
  if (ghlResult.ok && ghlResult.companyId && !business.ghlCompanyId) {
    await prisma.business.update({
      where: { id: business.id },
      data: { ghlCompanyId: ghlResult.companyId },
    })
    results.push({
      step: 'cache_company_id',
      ok: true,
      detail: `Cached ghlCompanyId ${ghlResult.companyId}`,
    })
  } else if (business.ghlCompanyId) {
    results.push({
      step: 'cache_company_id',
      ok: true,
      detail: `Already cached: ${business.ghlCompanyId}`,
    })
  }

  // Verdict
  const allOk = results.every((r) => r.ok)
  return NextResponse.json({
    ok: allOk,
    business: {
      id: business.id,
      name: business.name,
      expertPartnerSlug: business.expertPartnerSlug,
      ghlCompanyId: business.ghlCompanyId,
    },
    results,
    next_steps: ghlResult.ok
      ? [
          'Check GHL → Companies for a new/updated company tagged "expert-partner"',
          'Check GHL → Contacts for the test contact (tag: "movalliving-lead")',
          'Check GHL → Opportunities for the new opp in "Expert Partner Leads" → "New Lead"',
          'Check GHL → Workflows → history to see if your "Lead Notification" workflow fired',
          'Check Vercel logs for the partner email confirmation (SES notification)',
          `The test contact's email is test-${timestamp}@movalliving-test.invalid — easy to find and delete`,
        ]
      : [
          'Fix the failing step above',
          'Re-run this test',
          'When all green, you can promote a real partner publicly',
        ],
  })
}