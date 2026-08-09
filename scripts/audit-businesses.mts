/**
 * Unified audit runner — Pass 1 (free scraper) → Pass 2 (Tavily fallback).
 *
 * For each candidate business:
 *   1. Run free-scraper (direct HTTP, $0)
 *   2. If that hit Cloudflare/WAF (needsTavilyFallback), call Tavily
 *      Extract to get past the block. Costs ~2 Tavily credits.
 *   3. Merge results — Tavily's content fills in signals the free scraper
 *      couldn't get. Prefer free-scraper's email when both have one.
 *   4. Persist one BusinessAudit row per business
 *   5. Mirror summary + score + date back to GHL Company custom fields
 *
 * Usage:
 *   npx tsx scripts/audit-businesses.mts              # all 504
 *   npx tsx scripts/audit-businesses.mts --limit=5    # smoke test
 *   npx tsx scripts/audit-businesses.mts --limit=50   # batch
 *   npx tsx scripts/audit-businesses.mts --re-audit   # skip 7-day cache
 *
 * Skips businesses audited in the last 7 days unless --re-audit is set.
 */

import { getPrisma } from '../src/lib/prisma';
import { freeScrape } from './free-scraper.mjs';
import { auditBusiness } from './audit-runner.mjs';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const forceReaudit = args.includes('--re-audit');

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
  // GHL's Companies endpoint does NOT support writing custom fields
  // (only Contacts does). The audit data is the source of truth in
  // the moval DB and the admin UI; this function is a no-op kept for
  // future contact-level integration.
  return;
}

async function main() {
  const p = getPrisma();

  // Load candidates
  const where: any = { status: 'APPROVED', website: { not: null } };
  if (!forceReaudit) {
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

  console.log(`\n🔍 Auditing ${candidates.length} businesses`);
  console.log(
    `   Pass 1: direct HTTP (free) · Pass 2: Tavily fallback (when blocked)\n`
  );
  if (candidates.length === 0) {
    console.log('No candidates to audit.');
    await p.$disconnect();
    return;
  }

  let succeeded = 0;
  let failed = 0;
  let countUsedFree = 0;
  let countUsedTavily = 0;
  let emailsFound = 0;
  const scores: number[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.website) continue;
    const url = c.website.startsWith('http')
      ? c.website
      : `https://${c.website}`;

    let usedTavilyForThis = false;

    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.name} ... `);

    try {
      // ── Pass 1: free scraper ─────────────────────────────────────────
      let result = await freeScrape({
        businessId: c.id,
        businessName: c.name,
        website: url,
      });
      countUsedFree++;

      // ── Pass 2: Tavily fallback for WAF-blocked sites ───────────────
      if (result.needsTavilyFallback && TAVILY_API_KEY) {
        try {
          const tavilyResult = await auditBusiness({
            businessId: c.id,
            businessName: c.name,
            website: url,
          });
          result = {
            ...tavilyResult,
            socials: result.socials,
            foundEmail: result.foundEmail || tavilyResult.foundEmail,
            foundPhone: result.foundPhone || tavilyResult.foundPhone,
            needsTavilyFallback: result.needsTavilyFallback,
          };
          usedTavilyForThis = true;
          countUsedTavily++;
        } catch (e: any) {
          console.log(`[Tavily fallback failed: ${e.message?.slice(0, 50)}]`, '');
        }
      }

      // ── Persist ──────────────────────────────────────────────────────
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
          rawSignals: {
            ...result.rawSignals,
            usedFree: true,
            usedTavily: usedTavilyForThis,
          } as any,
        },
      });

      // ── GHL mirror (best-effort) ─────────────────────────────────────
      if (GHL_API_KEY) {
        let ghlId = c.ghlCompanyId;
        if (!ghlId) ghlId = await ghlGetCompanyIdByName(c.name);
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
            (missing.length > 0
              ? ` · Missing: ${missing.join(', ')}`
              : '');

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

    // Polite pause — Tavily is the bottleneck
    if ((i + 1) % 5 === 0 && i + 1 < candidates.length) {
      await sleep(2000);
    } else {
      await sleep(300);
    }
  }

  console.log(`\n─── Summary ───`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Free scraper runs: ${countUsedFree}`);
  console.log(`Tavily fallback runs: ${countUsedTavily}`);
  console.log(`Emails found: ${emailsFound}/${candidates.length}`);
  if (scores.length > 0) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log(
      `Score avg: ${avg} · median: ${median} · min: ${sorted[0]} · max: ${sorted[sorted.length - 1]}`
    );
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});