// scripts/render-og-cards.mjs
// Build-time OG card renderer. Generates a static PNG per Best-Of category
// into public/og/[slug].png. Why static instead of dynamic?
//
// Dynamic via /opengraph-image.tsx + next/og + Satori has been the source
// of every 500 in this build (Aug 22). The function 500s whenever fonts
// are involved — /public is on the edge CDN only (ENOENT), fetch() to
// self hangs in the function context, and we can't easily ship a font
// binary through Turbopack's module graph.
//
// Static-at-build wins for Stage 1 because:
//  1. /best-of/[category] has stable content (category name + winner).
//     It only changes when an admin updates winners.
//  2. ISR-on-demand via revalidatePath() handles the regen case.
//  3. No runtime render cost — Vercel serves the PNG from edge.
//  4. Drops the entire next/og + ImageResponse dependency for OG cards.
//
// Future stages (vote cards, nominee cards) ARE dynamic — different
// content per request. Those will need the dynamic route working and
// we'll solve the font-bundling then. For Stage 1, static is the right
// answer.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const REPO = process.cwd()
const FONTS_DIR = join(REPO, 'fonts')
const OUT_DIR = join(REPO, 'public/og')

const [frauncesBuf, interBuf] = await Promise.all([
  readFile(join(FONTS_DIR, 'Fraunces-Bold.ttf')),
  readFile(join(FONTS_DIR, 'Inter-SemiBold.ttf')),
])

function nameFontSize(name) {
  const len = name.length
  if (len <= 18) return 88
  if (len <= 28) return 72
  if (len <= 40) return 60
  return 50
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

async function renderCard({ name, description, nomineeCount, slug }) {
  const fontSize = nameFontSize(name)

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundImage: 'linear-gradient(135deg, #00405c 0%, #007a7f 100%)',
          fontFamily: 'Inter',
          color: '#f0efeb',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      fontFamily: 'Inter',
                      fontSize: 22,
                      fontWeight: 600,
                      letterSpacing: '0.18em',
                      color: '#f0efeb',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            width: 14,
                            height: 14,
                            borderRadius: 999,
                            background: '#c9786d',
                            display: 'flex',
                          },
                        },
                      },
                      { type: 'span', props: { children: 'BEST OF MOVAL · 2026' } },
                    ],
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontFamily: 'Inter',
                      fontSize: 20,
                      fontWeight: 600,
                      color: 'rgba(240, 239, 235, 0.75)',
                    },
                    children: 'moval.living/best-of',
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontFamily: 'Fraunces',
                      fontSize,
                      fontWeight: 700,
                      lineHeight: 1.05,
                      letterSpacing: '-0.02em',
                      color: '#f0efeb',
                      display: 'flex',
                    },
                    children: name,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontFamily: 'Inter',
                      fontSize: 30,
                      fontWeight: 600,
                      color: 'rgba(240, 239, 235, 0.85)',
                      display: 'flex',
                      maxWidth: 900,
                    },
                    children: truncate(description ?? `${nomineeCount} nominees · community voting`, 110),
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                width: '100%',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontFamily: 'Inter',
                      fontSize: 22,
                      fontWeight: 600,
                      color: 'rgba(240, 239, 235, 0.75)',
                      display: 'flex',
                    },
                    children: `${nomineeCount} ${nomineeCount === 1 ? 'nominee' : 'nominees'} · Moreno Valley, CA`,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
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
                    },
                    children: 'See the winners →',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Fraunces', data: frauncesBuf, weight: 700, style: 'normal' },
        { name: 'Inter', data: interBuf, weight: 600, style: 'normal' },
      ],
    },
  )

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
  return resvg.render().asPng()
}

await mkdir(OUT_DIR, { recursive: true })

const categoriesRes = await pool.query(`
  SELECT
    c.slug, c.name, c.description,
    COUNT(n.id)::int AS "nomineeCount"
  FROM "BestOfCategory" c
  LEFT JOIN "BestOfNominee" n ON n."categoryId" = c.id
  WHERE c.published = true
  GROUP BY c.id
  ORDER BY c.name ASC
`)
const categories = categoriesRes.rows

console.log(`Rendering ${categories.length} OG cards…`)

for (const cat of categories) {
  const png = await renderCard({
    name: cat.name,
    description: cat.description,
    nomineeCount: cat.nomineeCount,
    slug: cat.slug,
  })
  const out = join(OUT_DIR, `${cat.slug}.png`)
  await writeFile(out, png)
  console.log(`  ${cat.slug}: ${(png.length / 1024).toFixed(1)} KB (${cat.nomineeCount} ${cat.nomineeCount === 1 ? 'nominee' : 'nominees'})`)
}

// Generic fallback card (for slugs that don't exist or aren't published)
const fallback = await renderCard({
  name: 'Best Of Moreno Valley',
  description: 'Curated picks from the MoVal Living editors.',
  nomineeCount: 0,
  slug: 'fallback',
})
await writeFile(join(OUT_DIR, 'fallback.png'), fallback)
console.log(`  fallback: ${(fallback.length / 1024).toFixed(1)} KB`)

await pool.end()
console.log('Done.')
