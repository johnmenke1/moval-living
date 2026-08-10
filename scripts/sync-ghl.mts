/**
 * Sync moval.living businesses → GHL Companies endpoint.
 *
 * Uploads every business that has ANY contact info (phone, email,
 * website, or address) as a Company record in GoHighLevel so we can
 * run outreach, store audit data, and link to workflows.
 *
 * Field mapping (DB → GHL Companies):
 *   name         → name
 *   phone        → phone
 *   email        → email
 *   website      → website
 *   address      → address
 *   city         → city
 *   state        → state
 *   zip          → postalCode
 *   slug         → (not supported by Companies endpoint; stored in DB)
 *   ghlCompanyId → id (set after creation, then re-used on update)
 *
 * Idempotency: if the business already has a ghlCompanyId, the script
 * updates the existing record (PUT) instead of creating a new one.
 *
 * Filter: status=APPROVED AND (phone IS NOT NULL OR email IS NOT NULL
 *         OR website IS NOT NULL OR address != '')
 *
 * Usage:
 *   GHL_API_TOKEN=... GHL_LOCATION_ID=... npx tsx scripts/sync-ghl.mts
 *   [--limit=10]         # smoke test
 *   [--dry-run]          # show what would be created, no API calls
 *   [--only-missing]     # skip businesses that already have ghlCompanyId
 *   [--only-with-email]  # sync only businesses that have an email set
 *                        # (useful for pushing newly-discovered emails)
 *
 * Rate limit: GHL allows ~100 req/min on Companies. We sleep 700ms
 * between calls so a 100-business run takes ~70s. Safe under the limit.
 */

const GHL_TOKEN = process.env.GHL_API_TOKEN;
const GHL_LOC = process.env.GHL_LOCATION_ID;
if (!GHL_TOKEN) {
  console.error('GHL_API_TOKEN not set');
  process.exit(1);
}
if (!GHL_LOC) {
  console.error('GHL_LOCATION_ID not set');
  process.exit(1);
}

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const DRY_RUN = args.includes('--dry-run');
const ONLY_MISSING = args.includes('--only-missing');
const ONLY_WITH_EMAIL = args.includes('--only-with-email');

import { getPrisma } from '../src/lib/prisma';

// Raw SQL helpers — Prisma's generated types include columns that
// don't exist in the live DB (e.g. foundingPartnerRate). Raw SQL
// avoids that schema-drift mismatch.
function sqlEscape(value: string | null | undefined): string {
  if (value == null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

async function saveGhlId(businessId: string, ghlCompanyId: string) {
  const { Client } = await import('pg');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(
      `UPDATE "Business" SET "ghlCompanyId" = ${sqlEscape(ghlCompanyId)}, "ghlLocationId" = ${sqlEscape(GHL_LOC)}, "updatedAt" = NOW() WHERE id = ${sqlEscape(businessId)}`
    );
  } finally {
    await client.end();
  }
}

interface GhCompany {
  name: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  postalCode: string;
  country: string;
}

async function ghlUpsert(
  business: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string;
    city: string;
    state: string;
    zip: string;
    ghlCompanyId: string | null;
  }
): Promise<{ ghlId: string; action: 'created' | 'updated' }> {
  // Normalize website — must include protocol for GHL to render it
  let website = business.website;
  if (website && !/^https?:\/\//i.test(website)) {
    website = `https://${website}`;
  }

  // Normalize phone — strip non-digits except + leading char
  let phone = business.phone;
  if (phone) {
    const cleaned = phone.replace(/[^\d+()\-.\s]/g, '').trim();
    phone = cleaned || null;
  }

  const body: GhCompany = {
    name: business.name,
    phone: phone ?? null,
    email: business.email ?? null,
    website: website ?? null,
    address: business.address,
    city: business.city,
    state: business.state,
    postalCode: business.zip,
    country: 'us',
  };

  // Drop empty strings (GHL rejects them on some fields)
  for (const k of Object.keys(body) as (keyof GhCompany)[]) {
    if (body[k] === '') body[k] = null as any;
  }

  let res: Response;
  if (business.ghlCompanyId) {
    // Update existing
    res = await fetch(
      `https://services.leadconnectorhq.com/businesses/${business.ghlCompanyId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${GHL_TOKEN}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      // If PUT 404s (GHL deleted the record), fall through to POST
      if (res.status === 404) {
        // fall through to create
      } else {
        const txt = await res.text();
        throw new Error(`PUT ${res.status}: ${txt.slice(0, 200)}`);
      }
    } else {
      const data = await res.json();
      return { ghlId: business.ghlCompanyId, action: 'updated' };
    }
  }

  // Create new (or re-create after 404)
  res = await fetch('https://services.leadconnectorhq.com/businesses/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GHL_TOKEN}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locationId: GHL_LOC,
      ...body,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`POST ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const ghlId = data.business?.id;
  if (!ghlId) {
    throw new Error(`POST returned no id: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { ghlId, action: 'created' };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const p = getPrisma();

  // Load businesses with any contact info
  const where: any = {
    status: 'APPROVED',
    OR: [
      { phone: { not: null } },
      { email: { not: null } },
      { website: { not: null } },
      { address: { not: '' } },
    ],
  };
  if (ONLY_MISSING) {
    where.ghlCompanyId = null;
  }
  if (ONLY_WITH_EMAIL) {
    where.email = { not: null };
    where.ghlCompanyId = { not: null };
  }

  const candidates = await p.business.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      phone: true,
      email: true,
      website: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      ghlCompanyId: true,
    },
    orderBy: { name: 'asc' },
    take: LIMIT ?? undefined,
  });

  console.log(`\n📤 GHL sync: ${candidates.length} businesses`);
  console.log(
    `   Mode: ${DRY_RUN ? 'DRY RUN' : ONLY_MISSING ? 'missing only' : ONLY_WITH_EMAIL ? 'with-email only' : 'all'}\n`
  );

  let created = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const failures: { name: string; error: string }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    process.stdout.write(
      `[${i + 1}/${candidates.length}] ${c.name.padEnd(40)} `
    );

    if (DRY_RUN) {
      const contactFields = [
        c.phone ? '📞' : '',
        c.email ? '✉️' : '',
        c.website ? '🌐' : '',
        c.address ? '🏠' : '',
      ]
        .filter(Boolean)
        .join('');
      console.log(`would sync ${contactFields} (ghlId=${c.ghlCompanyId ?? 'NEW'})`);
      continue;
    }

    try {
      const result = await ghlUpsert(c);
      await saveGhlId(c.id, result.ghlId);

      if (result.action === 'created') {
        created++;
        console.log(`✓ created ${result.ghlId}`);
      } else {
        updated++;
        console.log(`✓ updated ${result.ghlId}`);
      }
    } catch (e: any) {
      failed++;
      const msg = e.message?.slice(0, 120) ?? String(e);
      failures.push({ name: c.name, error: msg });
      console.log(`✗ ${msg}`);
    }

    // Rate limit: 700ms between calls = ~85/min, well under 100/min limit
    if (i + 1 < candidates.length) await sleep(700);
  }

  console.log(`\n─── Summary ───`);
  console.log(`Total:        ${candidates.length}`);
  console.log(`Created:      ${created}`);
  console.log(`Updated:      ${updated}`);
  console.log(`Failed:       ${failed}`);
  console.log(`Skipped:      ${skipped}`);

  if (failures.length > 0) {
    console.log(`\n⚠️  Failures:`);
    failures.slice(0, 20).forEach((f) =>
      console.log(`   ${f.name.padEnd(40)} ${f.error}`)
    );
    if (failures.length > 20) {
      console.log(`   ... and ${failures.length - 20} more`);
    }
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});