#!/usr/bin/env node
// scripts/backfill-chamber-addresses-2026-08-09.mjs
//
// One-shot script to fix the 200+ APPROVED chamber-imported businesses that
// were created with `address: 'Address pending verification'` because the
// original chamber-importer didn't extract the street field.
//
// Flow:
//   1. Scrape every chamber bucket
//   2. Build a normalized-name → { street, city, zip, phone } lookup
//   3. Query our DB for APPROVED businesses where chamberMember = true AND
//      address looks like a placeholder
//   4. Match each by normalized name, UPDATE the address (and city/zip/phone
//      if they're also placeholder defaults)
//
// Usage:
//   node scripts/backfill-chamber-addresses-2026-08-09.mjs              # dry-run
//   node scripts/backfill-chamber-addresses-2026-08-09.mjs --apply      # commit
//
// Safe to re-run (idempotent on the matched fields).

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Client } from 'pg'
import { config } from 'dotenv'
import * as cheerio from 'cheerio'

config({ path: '.env.local' })

const APPLY = process.argv.includes('--apply')

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '..', 'reports')

const BASE_URL = 'https://business.movalchamber.org'
const LIST_URL = (b) => `${BASE_URL}/list/searchalpha/${b}`
const ALL_BUCKETS = [
  '0-9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
]
const PAGE_DELAY_MS = 500

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function normalizeName(s) {
  return s
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company|the)\b\.?/g, '')
    .replace(/[.,'"!?&]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function scrapeAll() {
  const all = []
  for (const b of ALL_BUCKETS) {
    try {
      const res = await fetch(LIST_URL(b), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MovalLivingChamberBackfill/1.0)' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const $ = cheerio.load(html)
      $('.gz-list-card-wrapper').each((_, card) => {
        const $card = $(card)
        const $nameLink = $card.find('.gz-card-title a').first()
        const name = $nameLink.text().trim()
        if (!name) return
        const street = $card.find('.gz-street-address').first().text().trim()
        const city = $card.find('.gz-address-city').first().text().trim()
        const addrText = $card.find('.gz-card-address').text()
        const allZips = addrText.match(/\b\d{5}(?:-\d{4})?\b/g)
        const zip = allZips && allZips.length ? allZips[allZips.length - 1].slice(0, 5) : ''
        const telHref = $card.find('a[href^="tel:"]').first().attr('href')
        const phone = telHref ? telHref.replace(/^tel:/, '') : null
        all.push({ name, street, city, zip, phone })
      })
      console.log(`  [${b}] scraped`)
    } catch (e) {
      console.error(`  [${b}] FAILED: ${e.message}`)
    }
    await sleep(PAGE_DELAY_MS)
  }
  return all
}

function isPlaceholderAddress(addr) {
  if (!addr) return true
  const lower = addr.toLowerCase().trim()
  return lower === 'address pending verification' || lower.startsWith('address pending')
}

function isPlaceholderZip(zip) {
  return !zip || zip === '92553' // the import fallback Emma used
}

async function main() {
  console.log(`\n=== Chamber Address Backfill (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`)
  console.log('Scraping chamber directory…')
  const members = await scrapeAll()
  console.log(`\nScraped ${members.length} chamber members total.`)

  // Build lookup by normalized name
  const byName = new Map()
  for (const m of members) {
    byName.set(normalizeName(m.name), m)
  }

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()

  // Find APPROVED businesses that look like chamber imports
  const r = await c.query(`
    SELECT id, name, slug, address, city, state, zip, phone, "chamberMember"
    FROM "Business"
    WHERE status = 'APPROVED'
      AND "chamberMember" = true
  `)
  console.log(`\nFound ${r.rows.length} APPROVED chamber businesses in our DB.\n`)

  const updates = []
  const noMatch = []
  const skipped = []

  for (const biz of r.rows) {
    if (!isPlaceholderAddress(biz.address)) {
      skipped.push({ name: biz.name, reason: 'address already real' })
      continue
    }
    const chamberMatch = byName.get(normalizeName(biz.name))
    if (!chamberMatch || !chamberMatch.street) {
      noMatch.push({ name: biz.name, currentAddress: biz.address })
      continue
    }
    updates.push({
      id: biz.id,
      slug: biz.slug,
      name: biz.name,
      oldAddress: biz.address,
      oldZip: biz.zip,
      newAddress: chamberMatch.street,
      newCity: chamberMatch.city || biz.city,
      newZip: chamberMatch.zip && !isPlaceholderZip(chamberMatch.zip) ? chamberMatch.zip : biz.zip,
      newPhone: chamberMatch.phone || biz.phone,
    })
  }

  console.log(`Would update:     ${updates.length}`)
  console.log(`Already real:     ${skipped.length}`)
  console.log(`No chamber match: ${noMatch.length}\n`)

  if (updates.length > 0) {
    console.log('Sample updates (first 5):')
    for (const u of updates.slice(0, 5)) {
      console.log(`  ${u.name}`)
      console.log(`    OLD: ${u.oldAddress}`)
      console.log(`    NEW: ${u.newAddress}, ${u.newCity} ${u.newZip}`)
    }
    console.log()
  }

  if (noMatch.length > 0 && noMatch.length <= 20) {
    console.log('No-match names (will keep placeholder):')
    for (const n of noMatch) {
      console.log(`  ${n.name}`)
    }
    console.log()
  }

  // Write report (always — useful even on dry-run)
  await writeFile(
    resolve(OUT_DIR, 'chamber-backfill-2026-08-09.json'),
    JSON.stringify({ scannedAt: new Date().toISOString(), apply: APPLY, updates, skipped, noMatch }, null, 2)
  )
  console.log(`Wrote: reports/chamber-backfill-2026-08-09.json\n`)

  if (!APPLY) {
    console.log('Dry-run. Re-run with --apply to commit.\n')
    await c.end()
    return
  }

  if (updates.length === 0) {
    console.log('Nothing to apply.')
    await c.end()
    return
  }

  let applied = 0
  let errors = 0
  for (const u of updates) {
    try {
      await c.query(
        `UPDATE "Business" SET address = $1, city = $2, zip = $3, phone = $4, "updatedAt" = NOW() WHERE id = $5`,
        [u.newAddress, u.newCity, u.newZip, u.newPhone, u.id]
      )
      applied++
    } catch (e) {
      errors++
      console.error(`  FAILED ${u.name}: ${e.message}`)
    }
  }

  console.log(`Applied: ${applied}`)
  console.log(`Errors:  ${errors}`)
  await c.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
