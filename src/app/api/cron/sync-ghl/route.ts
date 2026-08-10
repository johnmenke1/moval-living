/**
 * GET /api/cron/sync-ghl
 *
 * Vercel Cron endpoint — runs every 15 min via vercel.json.
 * See vercel.json for the schedule definition.
 *
 * Auth: requires `x-cron-secret` header to match process.env.CRON_SECRET.
 * Vercel Cron automatically sends this header (configured in the
 * dashboard or via the `CRON_SECRET` env var).
 *
 * The body of the request is logged but not consumed.
 *
 * Returns:
 *   { ok: true, total, created, updated, failed, failures?, processed? }
 *   { ok: false, error: 'Unauthorized' } (401)
 *   { ok: false, error: '...' } (500)
 *
 * For the cron run we only care about NEW businesses (onlyMissing: true)
 * since regular full-syncs are still run manually via scripts/sync-ghl.mts.
 * The cron job is the "catch the new ones" safety net.
 *
 * Time: a typical run with 0-3 new businesses finishes in <5s. Larger
 * backlogs (e.g. after a long GHL downtime) cap at the Vercel function
 * timeout (default 10s on Hobby, 60s on Pro). Worst case: a few lag
 * cycles to catch up.
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncBusinessesToGhl } from '@/lib/ghl-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro: 60s. Hobby: 10s (Vercel will warn).

export async function GET(req: NextRequest) {
  // Auth: x-cron-secret header must match env
  const secret = req.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET not set on server' },
      { status: 500 }
    );
  }
  if (secret !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncBusinessesToGhl({ onlyMissing: true });
    const summary: any = {
      ok: true,
      total: result.total,
      created: result.created,
      updated: result.updated,
      failed: result.failed,
    };
    if (result.failed > 0) {
      summary.failures = result.failures.slice(0, 10);
    }
    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message ?? String(e) },
      { status: 500 }
    );
  }
}
