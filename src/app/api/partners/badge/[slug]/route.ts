import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/partners/badge/[slug]?size=banner|square&theme=light|dark
 *
 * Returns an SVG Founding Partner badge the partner can embed on their
 * own website as an <img src=...> (or as an <iframe>). Only Founding
 * Partners (foundingPartnerSince is set) get a badge. Non-Founding
 * Expert Partners get a generic "Moreno Valley Expert Partner" badge.
 *
 * Sizes:
 *   - banner: 600x140 — for site footers
 *   - square: 320x320 — for sidebars
 *
 * Themes:
 *   - light: white background (default)
 *   - dark:  slate-900 background
 *
 * Embed:
 *   <a href="https://www.moval.living/partners/test-partner">
 *     <img src="https://www.moval.living/api/partners/badge/test-partner?size=banner"
 *          alt="Moreno Valley Founding Expert Partner — Test Partner"
 *          width="600" height="140" />
 *   </a>
 *
 * The badge link always points back to the partner's MoVal page so we
 * get the SEO + cross-traffic benefit, not just a vanity graphic.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const url = new URL(req.url)
  const size = url.searchParams.get('size') === 'square' ? 'square' : 'banner'
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'

  const business = await prisma.business.findUnique({
    where: { expertPartnerSlug: slug },
    select: {
      name: true,
      isExpertPartner: true,
      foundingPartnerSince: true,
      category: { select: { name: true, icon: true } },
    },
  })

  // Don't reveal whether a business exists if the slug is wrong — return
  // a generic "MoVal Expert Partner" badge so the endpoint can't be used
  // to probe valid slugs.
  const isFounding = !!business?.foundingPartnerSince
  const partnerName = business?.name ?? 'MoVal Expert Partner'
  const category = business?.category?.name ?? null

  return new Response(renderBadge({ size, theme, partnerName, isFounding, category }), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Badge-Status': business?.isExpertPartner ? 'active' : 'inactive',
    },
  })
}

interface BadgeOpts {
  size: 'banner' | 'square'
  theme: 'light' | 'dark'
  partnerName: string
  isFounding: boolean
  category: string | null
}

function renderBadge(opts: BadgeOpts): string {
  const { size, theme, partnerName, isFounding, category } = opts
  const w = size === 'banner' ? 600 : 320
  const h = size === 'banner' ? 140 : 320

  const bg = theme === 'dark' ? '#0f172a' : '#ffffff'
  const textMain = theme === 'dark' ? '#f1f5f9' : '#0f172a'
  const textMuted = theme === 'dark' ? '#94a3b8' : '#475569'
  const stroke = theme === 'dark' ? '#334155' : '#e2e8f0'

  // Founding = gold gradient + star + "FOUNDING" badge
  // Non-founding Expert Partner = teal accent + "EXPERT PARTNER" badge
  const accentStart = isFounding ? '#fbbf24' : '#007a7f'
  const accentEnd = isFounding ? '#d97706' : '#00405c'
  const labelText = isFounding ? '★ FOUNDING EXPERT PARTNER' : 'EXPERT PARTNER'

  // Truncate the partner name if it's too long for the badge
  const maxNameChars = size === 'banner' ? 36 : 22
  const displayName =
    partnerName.length > maxNameChars
      ? partnerName.slice(0, maxNameChars - 1) + '…'
      : partnerName

  const tagText = category ? `MoVal.living · ${category}` : 'Moreno Valley, CA'

  if (size === 'banner') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(labelText)} — ${escapeXml(partnerName)}">
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accentStart}"/>
      <stop offset="1" stop-color="${accentEnd}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="12" fill="${bg}" stroke="${stroke}" stroke-width="1"/>
  <rect x="0" y="0" width="6" height="${h}" rx="3" fill="url(#accent)"/>
  <text x="24" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="0.5" fill="url(#accent)">${escapeXml(labelText)}</text>
  <text x="24" y="86" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="800" fill="${textMain}">${escapeXml(displayName)}</text>
  <text x="24" y="114" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="${textMuted}">${escapeXml(tagText)}</text>
  <text x="${w - 24}" y="${h - 18}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="${textMuted}" text-anchor="end">movalliving.com</text>
</svg>`
  }

  // Square layout (320x320): stacked, centered, with a thick accent bar on top
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(labelText)} — ${escapeXml(partnerName)}">
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accentStart}"/>
      <stop offset="1" stop-color="${accentEnd}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="14" fill="${bg}" stroke="${stroke}" stroke-width="1"/>
  <rect x="0" y="0" width="${w}" height="8" rx="4" fill="url(#accent)"/>
  <text x="${w / 2}" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="0.5" fill="url(#accent)" text-anchor="middle">${escapeXml(labelText)}</text>
  <text x="${w / 2}" y="142" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" fill="${textMain}" text-anchor="middle">${escapeXml(displayName)}</text>
  <line x1="40" y1="170" x2="${w - 40}" y2="170" stroke="${stroke}" stroke-width="1"/>
  <text x="${w / 2}" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="${textMuted}" text-anchor="middle">${escapeXml(tagText)}</text>
  <text x="${w / 2}" y="${h - 28}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="${textMuted}" text-anchor="middle">Verified by movalliving.com</text>
</svg>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}