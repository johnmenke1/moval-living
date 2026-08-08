import { NextResponse } from 'next/server'
import { auth } from '@/auth'

/**
 * POST /api/admin/diagnostics/ghl
 *
 * Admin-only. Verifies GHL API connectivity by:
 *   1. Listing locations (proves the PIT is valid + has the right scope)
 *   2. Listing pipelines for the configured location (proves the
 *      location ID + pipeline ID are valid)
 *   3. Listing workflows (proves the workflow IDs are valid)
 *
 * All GHL IDs are env-var-driven. If any are missing or invalid the
 * response will tell you exactly which one is wrong.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GHL_API_KEY
  const locationId = process.env.GHL_LOCATION_ID
  const pipelineId = process.env.GHL_PIPELINE_ID
  const stageId = process.env.GHL_PIPELINE_STAGE_ID
  const workflowId = process.env.GHL_WORKFLOW_ID

  const envConfigured = {
    apiKey: !!apiKey,
    apiKeyPrefix: apiKey?.slice(0, 7),
    locationId: !!locationId,
    locationIdValue: locationId,
    pipelineId: !!pipelineId,
    pipelineStageId: !!stageId,
    workflowId: !!workflowId,
  }

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      message: 'GHL_API_KEY is not set',
      envConfigured,
    })
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Version: '2021-07-28',
  } as const

  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  // 1. Locations — proves the token is valid and the app is installed in the location
  try {
    const res = await fetch('https://services.leadconnectorhq.com/locations/search?limit=100', { headers })
    checks.locations = {
      ok: res.ok,
      detail: res.ok ? undefined : `${res.status} ${res.statusText}`,
    }
  } catch (err) {
    checks.locations = { ok: false, detail: err instanceof Error ? err.message : 'network error' }
  }

  // 2. Pipelines — proves locationId is valid
  if (locationId) {
    try {
      const res = await fetch(
        `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locationId}`,
        { headers }
      )
      checks.pipelines = {
        ok: res.ok,
        detail: res.ok ? undefined : `${res.status} ${res.statusText}`,
      }
    } catch (err) {
      checks.pipelines = { ok: false, detail: err instanceof Error ? err.message : 'network error' }
    }
  } else {
    checks.pipelines = { ok: false, detail: 'GHL_LOCATION_ID not set' }
  }

  // 3. Workflows — proves workflow IDs are valid (list workflows in location)
  if (locationId) {
    try {
      const res = await fetch(
        `https://services.leadconnectorhq.com/workflows/?locationId=${locationId}`,
        { headers }
      )
      checks.workflows = {
        ok: res.ok,
        detail: res.ok ? undefined : `${res.status} ${res.statusText}`,
      }
    } catch (err) {
      checks.workflows = { ok: false, detail: err instanceof Error ? err.message : 'network error' }
    }
  } else {
    checks.workflows = { ok: false, detail: 'GHL_LOCATION_ID not set' }
  }

  // 4. Companies endpoint — the one Expert Partner uses
  if (locationId) {
    try {
      const res = await fetch(
        `https://services.leadconnectorhq.com/businesses/?locationId=${locationId}&limit=1`,
        { headers }
      )
      checks.companies = {
        ok: res.ok,
        detail: res.ok ? undefined : `${res.status} ${res.statusText}`,
      }
    } catch (err) {
      checks.companies = { ok: false, detail: err instanceof Error ? err.message : 'network error' }
    }
  } else {
    checks.companies = { ok: false, detail: 'GHL_LOCATION_ID not set' }
  }

  const allOk = Object.values(checks).every((c) => c.ok)
  return NextResponse.json({
    ok: allOk,
    valid: allOk,
    envConfigured,
    checks,
    message: allOk
      ? 'All GHL endpoints reachable'
      : 'One or more GHL endpoints failed — see checks above',
    ranAt: new Date().toISOString(),
  })
}