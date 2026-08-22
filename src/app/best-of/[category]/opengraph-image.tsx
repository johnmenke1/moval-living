import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { NextRequest } from 'next/server'

// Stage 1 spike — colocated OG image for /best-of/[category]
//
// Satori rules to remember (Claude's pitfalls, all confirmed):
//  - Flexbox only. No grid, no float, no absolute-position tricks.
//  - Fonts must be passed as data (TTF/OTF), not via <link>.
//  - Images need absolute URLs and are fetched at render time — keep small.
//  - Long names need stepped font sizes, not truncation.
//
// Brand palette (from src/app/globals.css):
//  --color-primary:   #007a7f   (teal)
//  --color-secondary: #00405c   (deep navy)
//  --color-accent:    #c9786d   (terracotta)
//  --color-background:#f0efeb   (warm off-white)
//
// Future font subsetting note: Fraunces-Bold.ttf is 360KB, Inter-SemiBold.ttf is
// 876KB. Total ~1.2MB per cold render. For the spike we accept this; if Vercel
// perf shows > 1s cold render, subset with pyftsubset against a sample of 50
// real MoVal business names. Not blocking the spike.

export const runtime = 'nodejs'
export const alt = 'Best Of MoVal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// ISR the image (matches the perf pattern from e9c36f7): regenerate at most
// once per hour. Vercel serves the cached PNG from edge until a winner
// changes, at which point the admin's revalidatePath() bumps it.
export const revalidate = 3600

// Lazy-load fonts at module scope — Satori reads them once per render, so
// reading at module init means warm renders skip the disk hit. The catch is
// this only works in Node-runtime; the `nodejs` export above is required.
let _fontsCache: { fraunces: Buffer; inter: Buffer } | null = null
async function loadFonts() {
  if (_fontsCache) return _fontsCache
  const [fraunces, inter] = await Promise.all([
    readFile(join(process.cwd(), 'src/assets/fonts/Fraunces-Bold.ttf')),
    readFile(join(process.cwd(), 'src/assets/fonts/Inter-SemiBold.ttf')),
  ])
  _fontsCache = { fraunces, inter }
  return _fontsCache
}

// Inline the prisma fetch so this file is colocated-only — Next 16 expects
// opengraph-image.tsx files to use the standard NextRequest/ImageResponse
// signature. We duplicate the getCategory shape from
// src/app/best-of/[category]/page.tsx; keeping it minimal (slug + name +
// description + nominee count) since the OG card only needs those.
async function getCategoryForOG(slug: string) {
  const { prisma } = await import('@/lib/prisma')
  return prisma.bestOfCategory.findUnique({
    where: { slug, published: true },
    select: {
      slug: true,
      name: true,
      description: true,
      icon: true,
      _count: { select: { nominees: true } },
    },
  })
}

// Step font size by name length — Claude's rule "Inland Empire Heating & Air
// Conditioning Specialists" needs a smaller size than "Grove Coffee House."
function nameFontSize(name: string): number {
  const len = name.length
  if (len <= 18) return 88
  if (len <= 28) return 72
  if (len <= 40) return 60
  return 50
}

export default async function OGImage(
  _req: NextRequest,
  { params }: { params: Promise<{ category: string }> },
) {
  const { category: slug } = await params
  const cat = await getCategoryForOG(slug)

  // Fall back to a generic MoVal card if the slug doesn't exist or isn't
  // published. Avoids 500s on social scrapers hitting stale URLs.
  const displayName = cat?.name ?? 'Best Of Moreno Valley'
  const nomineeCount = cat?._count.nominees ?? 0
  const subtitle = cat?.description?.slice(0, 110) ??
    `${nomineeCount} ${nomineeCount === 1 ? 'nominee' : 'nominees'} · community voting`

  const fonts = await loadFonts()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          // MoVal gradient: deep navy → teal, matching the in-page category
          // header (`bg-gradient-to-br from-primary to-secondary`).
          backgroundImage:
            'linear-gradient(135deg, #00405c 0%, #007a7f 100%)',
          fontFamily: 'Inter',
          color: '#f0efeb',
          position: 'relative',
        }}
      >
        {/* Top row — wordmark + brass accent */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: '#f0efeb',
              textTransform: 'uppercase',
            }}
          >
            {/* Brass dot — visual anchor for "local" brand */}
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: '#c9786d',
                display: 'flex',
              }}
            />
            Best Of MoVal · 2026
          </div>
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 20,
              fontWeight: 600,
              color: 'rgba(240, 239, 235, 0.75)',
            }}
          >
            moval.living/best-of
          </div>
        </div>

        {/* Center — category name + subtitle */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            width: '100%',
          }}
        >
          <div
            style={{
              fontFamily: 'Fraunces',
              fontSize: nameFontSize(displayName),
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: '#f0efeb',
              display: 'flex',
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 30,
              fontWeight: 600,
              color: 'rgba(240, 239, 235, 0.85)',
              display: 'flex',
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Footer — meta + CTA */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            width: '100%',
          }}
        >
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: 600,
              color: 'rgba(240, 239, 235, 0.75)',
              display: 'flex',
            }}
          >
            {nomineeCount > 0
              ? `${nomineeCount} ${nomineeCount === 1 ? 'nominee' : 'nominees'} · Moreno Valley, CA`
              : 'Moreno Valley, CA'}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 22px',
              borderRadius: 999,
              background: '#c9786d',
              fontFamily: 'Inter',
              fontSize: 22,
              fontWeight: 600,
              color: '#00405c',
            }}
          >
            See the winners →
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: fonts.fraunces, weight: 700, style: 'normal' },
        { name: 'Inter', data: fonts.inter, weight: 600, style: 'normal' },
      ],
    },
  )
}
