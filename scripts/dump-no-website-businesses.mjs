import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// All approved businesses without a website (NULL or empty string).
// Dumps every column needed for a human to verify a website by hand
// or to feed to an AI for verification:
// - identifiers (id, slug) so an upload-back can match cleanly
// - name + category for context
// - full postal address + phone for places.ai / Google search fallback
// - tier so FEATURED / Expert Partner rows are visually marked in the sheet
// - googleBusiness place_id (when present) so a verifier can hit Places API
//   directly if authorized — purely informational; we are NOT calling Places API here
// - logo/coverImage urls so a verifier can sanity-check photos
const rows = await prisma.business.findMany({
  where: {
    status: 'APPROVED',
    OR: [{ website: null }, { website: '' }],
  },
  select: {
    id: true,
    slug: true,
    name: true,
    address: true,
    city: true,
    state: true,
    zip: true,
    phone: true,
    email: true,
    tier: true,
    googleBusiness: true,
    logo: true,
    coverImage: true,
    category: { select: { name: true, slug: true } },
  },
  orderBy: [{ name: 'asc' }],
})

console.log('Total approved-without-website rows:', rows.length)

// Emit a CSV. RFC 4180-style:
// - CRLF line terminators (Excel-friendly)
// - Quote any field containing comma/quote/newline, double embedded quotes
const outDir = path.join(process.cwd(), 'scratch')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'no-website-businesses.csv')

const headers = [
  'id',
  'slug',
  'name',
  'category',
  'address',
  'city',
  'state',
  'zip',
  'phone',
  'email',
  'tier',
  'googleBusiness_place_id',
  'logo_url',
  'cover_url',
  // Empty column the human/AI fills in. Header makes it obvious they own this column.
  'verified_website',
]

function csvCell(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

const lines = [headers.join(',')]
for (const r of rows) {
  lines.push([
    r.id,
    r.slug,
    r.name,
    r.category?.name || '',
    r.address || '',
    r.city || '',
    r.state || '',
    r.zip || '',
    r.phone || '',
    r.email || '',
    r.tier,
    r.googleBusiness || '',
    r.logo || '',
    r.coverImage || '',
    '', // verified_website — empty for human/AI to fill in
  ].map(csvCell).join(','))
}
fs.writeFileSync(outPath, lines.join('\r\n') + '\r\n')

console.log('Wrote', outPath)
console.log('Lines:', lines.length, '(1 header +', rows.length, 'rows)')

await prisma.$disconnect()
await pool.end()
