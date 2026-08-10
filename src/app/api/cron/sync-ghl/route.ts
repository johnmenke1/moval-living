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
 *   { ok: true, companies: {...}, contacts: {...} }
 *   { ok: false, error: 'Unauthorized' } (401)
 *   { ok: false, error: '...' } (500)
 *
 * Two passes per run:
 *   1. Companies: pick up businesses that lack a ghlCompanyId (the
 *      "new business was just created" case). Cheap when nothing new.
 *   2. Contacts: pick up businesses-with-email that lack a ghlContactId
 *      (the "newly created business has an email" case AND the
 *      "claim flow didn't create a contact" case). Both are handled
 *      by the same filter.
 *
 * Both passes are pure catchup work — they only operate on missing
 * records. Regular full-syncs are still run manually via the scripts/.
 *
 * Time: typical run with 0-3 new records finishes in 2-5s. Worst
 * case is bounded by Vercel function timeout (maxDuration below).
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncBusinessesToGhl, syncContactsToGhl } from '@/lib/ghl-sync';

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

  const t0 = Date.now();

  try {
    // Pass 1: New Companies
    const companies = await syncBusinessesToGhl({ onlyMissing: true });

    // Pass 2: New Contacts (catches both new submissions AND claims)
    const contacts = await syncContactsToGhl({ onlyMissing: true });

    const summary: any = {
      ok: true,
      elapsedMs: Date.now() - t0,
      companies: {
        total: companies.total,
        created: companies.created,
        updated: companies.updated,
        failed: companies.failed,
      },
      contacts: {
        total: contacts.total,
        created: contacts.created,
        linkedExisting: contacts.linkedExisting,
        taggedExisting: contacts.taggedExisting,
        urlsWritten: contacts.urlsWritten,
        failed: contacts.failed,
      },
    };

    const failures: any[] = [];
    if (companies.failed > 0) {
      failures.push(...companies.failures.slice(0, 10).map((f) => ({ kind: 'company', ...f })));
    }
    if (contacts.failed > 0) {
      failures.push(...contacts.failures.slice(0, 10).map((f) => ({ kind: 'contact', ...f })));
    }
    if (failures.length > 0) {
      summary.failures = failures;
    }

    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message ?? String(e) },
      { status: 500 }
    );
  }
}
