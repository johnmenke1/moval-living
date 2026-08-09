/**
 * GET /api/admin/audits — return recent business audits for the admin dashboard.
 *
 * Query params:
 *   limit  — max number of rows to return (default 50, max 500)
 *   tier   — filter by score tier (critical | fair | good | solid)
 *   search — substring match on business name
 *
 * De-duplicates: keeps only the most recent audit per business (deltas
 * are stored in BusinessAudit rows, but the dashboard shows the latest).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const TIER_BOUNDARIES = {
  critical: [0, 40],
  fair: [40, 70],
  good: [70, 85],
  solid: [85, 101],
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(params.get('limit') ?? '50', 10) || 50, 500);
  const tier = params.get('tier') as keyof typeof TIER_BOUNDARIES | null;
  const search = params.get('search')?.toLowerCase() ?? '';

  // Fetch all audits ordered by most recent, then dedupe per businessId
  const allAudits = await prisma.businessAudit.findMany({
    orderBy: { auditedAt: 'desc' },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          website: true,
          email: true,
          phone: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });

  const seen = new Set<string>();
  const latest: typeof allAudits = [];
  for (const a of allAudits) {
    if (seen.has(a.businessId)) continue;
    seen.add(a.businessId);
    latest.push(a);
    if (latest.length >= limit) break;
  }

  // Apply filters
  let filtered = latest;
  if (tier && TIER_BOUNDARIES[tier]) {
    const [lo, hi] = TIER_BOUNDARIES[tier];
    filtered = filtered.filter((a) => a.score >= lo && a.score < hi);
  }
  if (search) {
    filtered = filtered.filter((a) =>
      a.business.name.toLowerCase().includes(search)
    );
  }

  // Summary stats
  const totalAudits = allAudits.length;
  const totalBusinesses = seen.size;
  const withEmail = allAudits.filter((a) => a.foundEmail).length;
  const tavilyUsed = allAudits.filter(
    (a) => (a.rawSignals as any)?.usedTavily === true
  ).length;
  const avgScore = totalAudits > 0
    ? Math.round(allAudits.reduce((s, a) => s + a.score, 0) / totalAudits)
    : 0;

  const tierCounts = {
    critical: 0,
    fair: 0,
    good: 0,
    solid: 0,
  };
  for (const a of allAudits) {
    if (a.score < 40) tierCounts.critical++;
    else if (a.score < 70) tierCounts.fair++;
    else if (a.score < 85) tierCounts.good++;
    else tierCounts.solid++;
  }

  return NextResponse.json({
    audits: filtered.map((a) => ({
      id: a.id,
      businessId: a.businessId,
      businessName: a.business.name,
      businessSlug: a.business.slug,
      businessWebsite: a.business.website,
      businessEmail: a.business.email,
      businessPhone: a.business.phone,
      categoryName: a.business.category.name,
      score: a.score,
      httpStatus: a.httpStatus,
      finalUrl: a.finalUrl,
      pageLoadMs: a.pageLoadMs,
      contentLength: a.contentLength,
      hasSsl: a.hasSsl,
      isMobileFriendly: a.isMobileFriendly,
      hasTitle: a.hasTitle,
      hasMetaDescription: a.hasMetaDescription,
      hasSingleH1: a.hasSingleH1,
      hasSitemap: a.hasSitemap,
      hasRobotsTxt: a.hasRobotsTxt,
      hasSchemaOrg: a.hasSchemaOrg,
      hasOpenGraph: a.hasOpenGraph,
      hasAltTextCoverage: a.hasAltTextCoverage,
      hasContactForm: a.hasContactForm,
      hasVisibleEmail: a.hasVisibleEmail,
      foundEmail: a.foundEmail,
      foundPhone: a.foundPhone,
      hasGoogleAnalytics: a.hasGoogleAnalytics,
      hasGoogleTagManager: a.hasGoogleTagManager,
      hasMetaPixel: a.hasMetaPixel,
      copyrightYear: a.copyrightYear,
      hasDeprecatedHtml: a.hasDeprecatedHtml,
      hasBlog: a.hasBlog,
      auditedAt: a.auditedAt,
      usedTavily: (a.rawSignals as any)?.usedTavily === true,
      fallbackReason: (a.rawSignals as any)?.fallbackReason,
    })),
    stats: {
      totalAudits,
      totalBusinesses,
      withEmail,
      tavilyUsed,
      avgScore,
      tierCounts,
    },
  });
}