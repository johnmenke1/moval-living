/**
 * Audit script: runs BusinessAudit on businesses from our DB.
 *
 * Usage:
 *   npx tsx scripts/audit-businesses.mts              # all 504
 *   npx tsx scripts/audit-businesses.mts --limit=5    # smoke test
 *   npx tsx scripts/audit-businesses.mts --limit=50   # batched
 *   npx tsx scripts/audit-businesses.mts --re-audit   # re-audit (don't skip recent)
 *
 * Filters out businesses that have been audited in the last 7 days
 * unless --re-audit is passed (we always want history).
 *
 * Persists one BusinessAudit row per business, plus mirrors summary +
 * score + date back to the GHL Company (if GHL_API_KEY + matching
 * ghlCompanyId is set on the Business).
 */

import { getPrisma } from '../src/lib/prisma';
import { auditBusiness } from './audit-runner.mjs';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const forceReaudit = args.includes('--re-audit');
const batchSize = 5; // Tavily advanced + 2 direct probes = small concurrency

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ghlGetCompanyIdByName(name: string): Promise<string | null> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) return null;
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/businesses/?locationId=${GHL_LOCATION_ID}&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: '2021-07-28',
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const match = (data.businesses || []).find(
      (b: any) => b.name?.toLowerCase().trim() === name.toLowerCase().trim()
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}

async function ghlUpdateCompanyCustomFields(
  ghlCompanyId: string,
  fields: { summary: string; score: number; date: string }
) {
  if (!GHL_API_KEY) return;
  try {
    // GHL custom fields for Companies are set via PUT /businesses/{id}
    // (different shape than Contact custom fields).
    await fetch(
      `https://services.leadconnectorhq.com/businesses/${ghlCompanyId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // These names need to match what Johnny created in GHL UI.
          // Adjust here if he uses different field names.
          customFields: [
            { key: 'movalliving_audit_summary', value: fields.summary },
            { key: 'movalliving_audit_score', value: String(fields.score) },
            { key: 'movalliving_audit_date', value: fields.date },
          ],
        }),
      }
    );
  } catch {
    // Best-effort mirror — never fail the audit on GHL errors
  }
}

async function main() {
  const p = getPrisma();

  // Load candidates
  const where: any = { status: 'APPROVED', website: { not: null } };
  if (!forceReaudit) {
    // Skip businesses audited in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    where.audits = { none: { auditedAt: { gte: sevenDaysAgo } } };
  }

  const candidates = await p.business.findMany({
    where,
    select: {
      id: true,
      name: true,
      website: true,
      ghlCompanyId: true,
    },
    orderBy: { name: 'asc' },
    take: limit ?? undefined,
  });

  console.log(`\n🔍 Auditing ${candidates.length} businesses\n`);
  if (candidates.length === 0) {
    console.log('No candidates to audit.');
    await p.$disconnect();
    return;
  }

  let succeeded = 0;
  let failed = 0;
  let emailsFound = 0;
  let scores: number[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.website) continue;
    const url = c.website.startsWith('http')
      ? c.website
      : `https://${c.website}`;

    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.name} (${url}) ... `);

    try {
      const result = await auditBusiness({
        businessId: c.id,
        businessName: c.name,
        website: url,
      });

      // Persist
      await p.businessAudit.create({
        data: {
          businessId: c.id,
          httpStatus: result.httpStatus,
          finalUrl: result.finalUrl,
          error: result.error,
          pageLoadMs: result.pageLoadMs,
          contentLength: result.contentLength,
          hasSsl: result.hasSsl,
          isMobileFriendly: result.isMobileFriendly,
          siteLoads: result.siteLoads,
          hasTitle: result.hasTitle,
          hasMetaDescription: result.hasMetaDescription,
          hasSingleH1: result.hasSingleH1,
          hasSitemap: result.hasSitemap,
          hasRobotsTxt: result.hasRobotsTxt,
          hasSchemaOrg: result.hasSchemaOrg,
          hasOpenGraph: result.hasOpenGraph,
          hasAltTextCoverage: result.hasAltTextCoverage,
          hasContactForm: result.hasContactForm,
          hasVisibleEmail: result.hasVisibleEmail,
          foundEmail: result.foundEmail,
          foundPhone: result.foundPhone,
          hasGoogleAnalytics: result.hasGoogleAnalytics,
          hasGoogleTagManager: result.hasGoogleTagManager,
          hasMetaPixel: result.hasMetaPixel,
          copyrightYear: result.copyrightYear,
          hasDeprecatedHtml: result.hasDeprecatedHtml,
          hasBlog: result.hasBlog,
          score: result.score,
          rawHtml: result.rawHtml,
          rawSignals: result.rawSignals as any,
        },
      });

      // GHL mirror (best-effort, don't block)
      if (GHL_API_KEY) {
        let ghlId = c.ghlCompanyId;
        if (!ghlId) {
          ghlId = await ghlGetCompanyIdByName(c.name);
        }
        if (ghlId) {
          const missing: string[] = [];
          if (!result.hasSsl) missing.push('SSL');
          if (!result.isMobileFriendly) missing.push('mobile');
          if (!result.hasContactForm) missing.push('contact form');
          if (!result.hasGoogleAnalytics) missing.push('GA');
          if (!result.hasSitemap) missing.push('sitemap');
          if (!result.hasOpenGraph) missing.push('OG tags');
          if (!result.hasMetaDescription) missing.push('meta desc');
          const summary =
            `Score: ${result.score}/100` +
            (missing.length > 0 ? ` · Missing: ${missing.join(', ')}` : '');

          await ghlUpdateCompanyCustomFields(ghlId, {
            summary,
            score: result.score,
            date: new Date().toISOString().slice(0, 10),
          });
        }
      }

      succeeded++;
      scores.push(result.score);
      if (result.foundEmail) emailsFound++;
      console.log(
        `✓ score=${result.score} email=${result.foundEmail ?? '—'} status=${result.httpStatus}`
      );
    } catch (e: any) {
      failed++;
      console.log(`✗ ERROR: ${e.message?.slice(0, 80) ?? e}`);
    }

    // Polite pause between batches (Tavily rate limits)
    if ((i + 1) % batchSize === 0 && i + 1 < candidates.length) {
      await sleep(2000);
    } else {
      await sleep(500);
    }
  }

  console.log(`\n─── Summary ───`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Emails found: ${emailsFound}/${candidates.length}`);
  if (scores.length > 0) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log(`Score avg: ${avg} · median: ${median} · min: ${sorted[0]} · max: ${sorted[sorted.length - 1]}`);
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});