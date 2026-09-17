/**
 * purge-dead-google-photos.mjs
 *
 * One-shot data migration. In ~Sept 2024 Google shut down public CDN
 * serving for Places photos on `lh3.googleusercontent.com/place-photos/`.
 * Direct browser requests now return 403 with no way around it (no Referer,
 * no UA, no size suffix trick works).
 *
 * Moval.Living imported ~2,110 of those URLs into Business.photos[] (and
 * 377 logos, 384 coverImages) via an early enrichment pipeline. We can't
 * revive them without paying Google Places API again — and Johnny's
 * previous enrichment run cost $82, so re-fetching all 400 affected
 * businesses is off the table right now.
 *
 * This script PURGES the dead URLs:
 *   - `Business.photos[]` entries matching the dead pattern → dropped
 *   - If the entire `photos[]` ends up empty, it's set to [] (so the
 *     gallery on /business/[slug] simply doesn't render — there's already
 *     an empty-state guard there.)
 *   - `Business.logo` matching the pattern → set to null (BusinessCard
 *     falls through to coverImage, then the initial-letter gradient)
 *   - `Business.coverImage` matching the pattern → set to null (same
 *     fallback chain)
 *
 * No Google API calls. Pure DB surgery. Idempotent: businesses with no
 * dead URLs are skipped.
 *
 * A JSON manifest of the purged businesses is written to
 * scripts/_dead-photos-manifest.json so we know exactly which 400 to
 * re-enrich when budget allows. The manifest includes `googleBusiness`
 * (Place ID) for each, so a future run can target just those without
 * re-paying the lookup phase.
 *
 * Usage:
 *   node scripts/purge-dead-google-photos.mjs --dry-run   # show what would change
 *   node scripts/purge-dead-google-photos.mjs             # actually run
 */

import { Pool } from 'pg'
import { readFileSync, writeFileSync } from 'node:fs'

const lines = readFileSync('./.env.local', 'utf8').split('\n')
const get = k => {
  const l = lines.find(x => x.startsWith(k + '='))
  if (!l) return ''
  let v = l.split('=').slice(1).join('=').trim()
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
  return v
}

const DRY_RUN = process.argv.includes('--dry-run')
const MANIFEST_PATH = './scripts/_dead-photos-manifest.json'

const pool = new Pool({
  connectionString: get('DATABASE_URL'),
  ssl: { rejectUnauthorized: false },
})

// The dead URL pattern: `https://lh3.googleusercontent.com/place-photos/`
// (followed by base64-ish token and an optional `=sNNN-wNNN` size suffix).
// Casing: we lowercase the prefix when matching because Google is case-
// insensitive on hostnames, but every observed entry uses the exact form
// below.
const DEAD_PREFIX = 'https://lh3.googleusercontent.com/place-photos/'
const isDead = url => typeof url === 'string' && url.startsWith(DEAD_PREFIX)

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN — no DB writes ===' : '=== PURGING DEAD GOOGLE PLACE PHOTOS ===')

  // 1) Pull all affected businesses in one query.
  const r = await pool.query(`
    SELECT id, name, slug, "googleBusiness", logo, "coverImage", photos
    FROM "Business"
    WHERE logo LIKE $1
       OR "coverImage" LIKE $1
       OR EXISTS (SELECT 1 FROM unnest(photos) AS p WHERE p LIKE $1)
    ORDER BY name
  `, [DEAD_PREFIX + '%'])

  console.log(`Found ${r.rows.length} affected businesses.\n`)

  const manifest = []
  let touchedLogos = 0
  let touchedCovers = 0
  let touchedPhotos = 0
  let photosDroppedTotal = 0
  let photosKeptTotal = 0

  for (const biz of r.rows) {
    const deadInLogo = isDead(biz.logo)
    const deadInCover = isDead(biz.coverImage)
    const livePhotos = (biz.photos || []).filter(p => !isDead(p))
    const droppedCount = (biz.photos || []).length - livePhotos.length

    if (!deadInLogo && !deadInCover && droppedCount === 0) continue

    const changes = []
    if (deadInLogo) changes.push(`logo (${DEAD_PREFIX}...)`)
    if (deadInCover) changes.push(`coverImage (${DEAD_PREFIX}...)`)
    if (droppedCount > 0) changes.push(`photos: -${droppedCount} (kept ${livePhotos.length})`)
    console.log(`  [${biz.id.slice(-8)}] ${biz.name.padEnd(36)} ${changes.join(', ')}`)

    if (!DRY_RUN) {
      const updates = []
      const values = []
      let i = 1
      if (deadInLogo) {
        updates.push(`logo = $${i++}`)
        values.push(null)
        touchedLogos++
      }
      if (deadInCover) {
        updates.push(`"coverImage" = $${i++}`)
        values.push(null)
        touchedCovers++
      }
      if (droppedCount > 0) {
        updates.push(`photos = $${i++}::text[]`)
        values.push(livePhotos)
        touchedPhotos++
        photosDroppedTotal += droppedCount
        photosKeptTotal += livePhotos.length
      }
      if (updates.length > 0) {
        updates.push(`"updatedAt" = NOW()`)
        values.push(biz.id)
        await pool.query(
          `UPDATE "Business" SET ${updates.join(', ')} WHERE id = $${i}`,
          values,
        )
      }
    } else {
      if (deadInLogo) touchedLogos++
      if (deadInCover) touchedCovers++
      if (droppedCount > 0) {
        touchedPhotos++
        photosDroppedTotal += droppedCount
        photosKeptTotal += livePhotos.length
      }
    }

    // Manifest entry — capture for follow-up re-enrichment when budget
    // allows. Includes enough context to skip the lookup phase.
    manifest.push({
      id: biz.id,
      slug: biz.slug,
      name: biz.name,
      googleBusiness: biz.googleBusiness, // Place ID; null if we ever lost it
      droppedFromPhotos: droppedCount,
      photosRemaining: livePhotos.length,
      hadDeadLogo: deadInLogo,
      hadDeadCover: deadInCover,
    })
  }

  console.log('\n=== SUMMARY ===')
  console.log(`Businesses affected:      ${r.rows.length}`)
  console.log(`Logos cleared:            ${touchedLogos}`)
  console.log(`Covers cleared:           ${touchedCovers}`)
  console.log(`photos[] arrays cleaned:  ${touchedPhotos}`)
  console.log(`Photos dropped (total):   ${photosDroppedTotal}`)
  console.log(`Photos kept (still alive):${photosKeptTotal}`)

  if (manifest.length > 0) {
    if (!DRY_RUN) {
      writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
      console.log(`\nManifest written to ${MANIFEST_PATH}`)
      console.log(`Use this list when you want to re-enrich (Google API cost TBD).`)
    } else {
      console.log(`\n[DRY RUN] Would write manifest with ${manifest.length} entries to ${MANIFEST_PATH}`)
    }
  }

  console.log(DRY_RUN ? '\n[DRY RUN] No changes were made. Re-run without --dry-run to apply.' : '\nDone.')
  await pool.end()
}

main().catch(e => { console.error(e); pool.end(); process.exit(1) })
