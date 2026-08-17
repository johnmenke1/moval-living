/* eslint-disable no-console */
/**
 * scripts/capture-park-photos.mts
 *
 * Step 9 of the /parks roadmap: enrich Park.photoUrls + .heroPhotoUrl by
 * uploading the City of Moreno Valley's official park images
 * (https://moval.gov/gis/parks/...) into our own Vercel Blob storage.
 *
 * Why this exists
 * ---------------
 * - The City's pic_url field is the authoritative source for park imagery
 *   (maintained as part of their GIS layer). It's free and we already have
 *   it in scripts/parks-curated.ts.
 * - We host on Vercel Blob instead of hot-linking the City's URL because:
 *     (a) The City can (and probably will) rebrand or retire their domain,
 *     (b) Static-img hot-links to a third-party domain are unreliable for
 *         SEO + Google Discover Cards,
 *     (c) Vercel gives us a CDN, transforms, and predictable URLs.
 *
 * Flow
 * ----
 *   1. Read all Park rows from DB (slug, id).
 *   2. Look up matching picUrl from parks-curated.ts by slug.
 *   3. Skip parks without a City picUrl (Vets Memorial, a few others).
 *   4. For each, fetch picUrl via HTTPS, upload to Vercel Blob at
 *        parks/{slug}/hero-{ts}.{ext}
 *   5. Write heroPhotoUrl + update photoUrls[] on the DB row.
 *
 * Idempotent
 * ----------
 * Re-running:
 *   - Skips rows that already have a non-null heroPhotoUrl.
 *   - Pass --force to re-upload (e.g., if the City's image changed).
 *   - Always writes a deterministic path WITHOUT a random suffix, so
 *     re-runs overwrite cleanly.
 *
 * Run:  DATABASE_URL=... BLOB_READ_WRITE_TOKEN=... node --experimental-strip-types \
 *       scripts/capture-park-photos.mts
 *       (with optional --force flag)
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { put } from '@vercel/blob'
import { PARKS_CURATED } from './parks-curated.ts'

const FORCE = process.argv.includes('--force')
const MAX_PARALLEL = 4
const DRY_RUN = process.argv.includes('--dry-run')

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

if (!DRY_RUN && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('[capture-park-photos] ❌ BLOB_READ_WRITE_TOKEN is not set in env.')
  console.error('    Get the token from Vercel Storage → Data Stores → your Blob store.')
  console.error('    (Use --dry-run to validate the script without uploading.)')
  process.exit(1)
}

interface PicRef {
  parkId: string
  slug: string
  name: string
  picUrl: string
}

async function gatherTargets(): Promise<PicRef[]> {
  const dbParks = await prisma.park.findMany({
    where: FORCE ? undefined : { heroPhotoUrl: null },
    select: { id: true, slug: true, name: true, heroPhotoUrl: true },
  })

  const bySlug = new Map(PARKS_CURATED.map((p) => [p.slug, p]))

  const out: PicRef[] = []
  for (const db of dbParks) {
    const cur = bySlug.get(db.slug)
    if (!cur || !cur.picUrl) continue
    out.push({ parkId: db.id, slug: db.slug, name: db.name, picUrl: cur.picUrl })
  }
  return out
}

function extensionFromUrl(url: string): 'jpg' | 'png' | 'webp' {
  const m = url.toLowerCase().match(/\.([a-z0-9]{2,5})(?:\?|$)/)
  const ext = m?.[1]
  if (ext === 'png' || ext === 'webp') return ext
  return 'jpg'
}

async function fetchToBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const ab = await res.arrayBuffer()
  return { buffer: Buffer.from(ab), contentType }
}

async function uploadOne(target: PicRef): Promise<string> {
  const ext = extensionFromUrl(target.picUrl)
  // include a microsecond counter + the slug's picUrl hash as a stable,
  // unique path. addRandomSuffix=false keeps the path predictable for
  // re-runs (overwrite by slug always wins). The slug + picUrl hash
  // guarantees uniqueness within a single script run so concurrent
  // batched uploads never collide on the same path.
  const path = `parks/${target.slug}/${slugHash(target.slug, target.picUrl)}.${ext}`
  const { buffer, contentType } = await fetchToBuffer(target.picUrl)
  const blob = await put(path, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
  })
  return blob.url
}

/** Deterministic 8-char hash of slug + picUrl so two parks never
 *  resolve to the same blob path even when timestamps collide. */
function slugHash(slug: string, url: string): string {
  // FNV-1a-ish — just good enough for unique-per-script-run namespacing.
  // We don't need cryptographic strength, just low collision probability.
  let h = 2166136261 >>> 0
  const s = `${slug}|${url}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return `hero-${h.toString(16).padStart(8, '0')}`
}

async function main() {
  console.log(`[capture-park-photos] ${FORCE ? 'FORCE re-upload' : 'skip rows with heroPhotoUrl set'}${DRY_RUN ? ' [DRY RUN]' : ''}`)
  const targets = await gatherTargets()
  console.log(`[capture-park-photos] ${targets.length} park(s) to capture`)

  if (DRY_RUN) {
    for (const t of targets.slice(0, 5)) {
      console.log(`  - ${t.slug.padEnd(45)} → ${t.picUrl}`)
    }
    if (targets.length > 5) {
      console.log(`  …and ${targets.length - 5} more`)
    }
    console.log('[capture-park-photos] DRY RUN — no uploads, no DB writes')
    return
  }

  // Sequential with a small concurrency cap so we don't hammer the City
  // or blow Vercel Blob rate limits.
  const results: Array<{ slug: string; status: 'ok' | 'failed'; url?: string; error?: string }> = []
  for (let i = 0; i < targets.length; i += MAX_PARALLEL) {
    const slice = targets.slice(i, i + MAX_PARALLEL)
    const batch = await Promise.all(
      slice.map(async (t) => {
        try {
          const url = await uploadOne(t)
          await prisma.park.update({
            where: { id: t.parkId },
            data: {
              heroPhotoUrl: url,
              photoUrls: { set: [url] },
            },
          })
          return { slug: t.slug, status: 'ok' as const, url }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          console.error(`  ❌ ${t.slug}: ${error}`)
          return { slug: t.slug, status: 'failed' as const, error }
        }
      }),
    )
    results.push(...batch)
  }

  const ok = results.filter((r) => r.status === 'ok').length
  const failed = results.filter((r) => r.status === 'failed').length
  console.log(`[capture-park-photos] ✅ done — ${ok}/${results.length} succeeded, ${failed} failed`)

  if (failed > 0) {
    for (const r of results.filter((r) => r.status === 'failed')) {
      console.log(`  - ${r.slug}: ${r.error}`)
    }
  }
}

main()
  .catch((err) => {
    console.error('[capture-park-photos] ❌ unexpected error', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
