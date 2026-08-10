/**
 * Push our DB businesses-with-email as Contacts into GoHighLevel.
 *
 * For each business in our DB that has both an email AND a ghlCompanyId:
 *   1. Check GHL if a contact with that email already exists at our location.
 *   2. If yes — PUT to update tags + businessId link.
 *   3. If no — POST to create, then PUT to link businessId.
 *
 * Contact shape:
 *   firstName:   "Team"
 *   lastName:    <business name>
 *   email:       <our stored email>
 *   phone:       <business phone, if any>
 *   locationId:  GHL_LOCATION_ID
 *   tags:        ["movalliving-cold-outreach"]
 *
 * After creation, save the GHL contactId back to our DB on
 * Business.ghlContactId so we have a permanent link for future syncs.
 *
 * Idempotent: re-running does not create duplicates — we look up by
 * email first and reuse the existing contact if found.
 *
 * Usage:
 *   GHL_API_TOKEN=... GHL_LOCATION_ID=... DATABASE_URL=... \
 *     npx tsx scripts/sync-ghl-contacts.mts
 *   [--limit=10]    # smoke test
 *   [--dry-run]     # show what would happen, no API calls
 *   [--skip-update] # only create missing, don't touch existing
 */

const TOKEN = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID;
if (!TOKEN) { console.error('GHL_API_TOKEN not set'); process.exit(1); }
if (!LOC) { console.error('GHL_LOCATION_ID not set'); process.exit(1); }

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
const DRY_RUN = args.includes('--dry-run');
const SKIP_UPDATE = args.includes('--skip-update');

const TAG = 'movalliving-cold-outreach';
const API = 'https://services.leadconnectorhq.com';
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Version: '2021-07-28',
  'Content-Type': 'application/json',
};

import { getPrisma } from '../src/lib/prisma';
import { Client } from 'pg';

function sqlEscape(v: string | null | undefined): string {
  if (v == null) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function saveGhlContactId(businessId: string, ghlContactId: string) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      `UPDATE "Business" SET "ghlContactId" = ${sqlEscape(ghlContactId)}, "updatedAt" = NOW() WHERE id = ${sqlEscape(businessId)}`
    );
  } finally {
    await client.end();
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// Search GHL for an existing contact by email at our location.
// Returns the contact id, or null if not found.
async function findContactByEmail(email: string): Promise<string | null> {
  // POST /contacts/search with a JSON body containing an email filter
  const res = await fetch(`${API}/contacts/search`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      locationId: LOC,
      page: 0,
      pageLimit: 5,
      filters: [{ field: 'email', operator: 'eq', value: email }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`search POST failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as { contacts?: { id: string; email?: string }[] };
  const hit = data.contacts?.find((c) => c.email?.toLowerCase() === email.toLowerCase());
  return hit?.id ?? null;
}

async function createContact(b: {
  name: string;
  email: string;
  phone: string | null;
}): Promise<string> {
  // GHL rejects literal 'email' values that contain '/' or other URL-ish chars.
  // Country Kitchen bug surfaced: 'kristiinefinley@gmail.com/contact/' got a 422.
  const cleanEmail = b.email.includes('@') && !b.email.includes('/') ? b.email : null;
  if (!cleanEmail) {
    throw new Error(`POST /contacts/ invalid email: ${JSON.stringify(b.email)}`);
  }
  const body = {
    locationId: LOC,
    firstName: 'Team',
    lastName: b.name,
    email: cleanEmail,
    phone: b.phone ?? undefined,
    tags: [TAG],
    source: 'movalliving bulk import',
  };
  const res = await fetch(`${API}/contacts/`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (res.status === 400) {
    // "This location does not allow duplicated contacts" — the contact exists
    // but our pre-search missed it (search index lag). Re-search and reuse.
    const txt = await res.text();
    if (/duplicated contacts/i.test(txt)) {
      const existing = await findContactByEmail(cleanEmail);
      if (existing) return existing;
      throw new Error(`POST /contacts/ 400 dup but re-search found nothing: ${txt.slice(0, 200)}`);
    }
    throw new Error(`POST /contacts/ 400: ${txt.slice(0, 200)}`);
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`POST /contacts/ ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as { contact?: { id: string } } | { id?: string };
  if ('contact' in data && data.contact?.id) return data.contact.id;
  if ('id' in data && data.id) return data.id;
  throw new Error(`createContact: no id in response: ${JSON.stringify(data).slice(0, 200)}`);
}

async function linkContactToCompany(contactId: string, companyId: string): Promise<void> {
  const res = await fetch(`${API}/contacts/${contactId}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ businessId: companyId }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT /contacts/${contactId} businessId ${res.status}: ${txt.slice(0, 200)}`);
  }
}

async function updateContactTags(contactId: string, currentTags: string[]): Promise<void> {
  if (currentTags.includes(TAG)) return; // already tagged
  const res = await fetch(`${API}/contacts/${contactId}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ tags: [...currentTags, TAG] }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT /contacts/${contactId} tags ${res.status}: ${txt.slice(0, 200)}`);
  }
}

async function getContactTags(contactId: string): Promise<string[]> {
  const res = await fetch(`${API}/contacts/${contactId}?locationId=${LOC}`, { headers: HEADERS });
  if (!res.ok) return [];
  const data = await res.json() as { contact?: { tags?: string[] }; tags?: string[] };
  const tags = data.contact?.tags ?? data.tags;
  return tags ?? [];
}

async function main() {
  const p = getPrisma();
  const candidates = await p.business.findMany({
    where: {
      status: 'APPROVED',
      email: { not: null },
      ghlCompanyId: { not: null },
      // Skip if already linked
      ghlContactId: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      ghlCompanyId: true,
      ghlContactId: true,
    },
    orderBy: { name: 'asc' },
    take: LIMIT ?? undefined,
  });

  console.log(`\n📤 GHL Contacts sync: ${candidates.length} businesses`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : SKIP_UPDATE ? 'create-only' : 'create + update'}\n`);

  let created = 0;
  let linkedExisting = 0;
  let taggedExisting = 0;
  let failed = 0;
  const failures: { name: string; error: string }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.email || !c.ghlCompanyId) continue;
    process.stdout.write(`[${i + 1}/${candidates.length}] ${c.name.padEnd(40)} `);

    if (DRY_RUN) {
      console.log(`would sync ${c.email}`);
      continue;
    }

    try {
      // 1. Look for existing contact at our location with this email
      let contactId = await findContactByEmail(c.email);

      if (contactId) {
        console.log(`♻️  exists ${contactId}`);
        linkedExisting++;
      } else {
        // 2. Create new contact
        contactId = await createContact({
          name: c.name,
          email: c.email,
          phone: c.phone,
        });
        console.log(`✓ created ${contactId}`);
        created++;
        // small pause — GHL needs a beat to index the new contact before linking
        await sleep(300);
      }

      // 3. Link contact to company (PUT businessId) — even if contact pre-existed
      await linkContactToCompany(contactId, c.ghlCompanyId);

      // 4. Ensure the tag is set
      if (!SKIP_UPDATE) {
        const currentTags = await getContactTags(contactId);
        if (!currentTags.includes(TAG)) {
          await updateContactTags(contactId, currentTags);
          taggedExisting++;
        }
      }

      // 5. Save contactId to our DB — but if it's a duplicate business row
      // sharing the same email (e.g. 15 schools at klewis@mvusd.net),
      // we must NOT write the same contactId into multiple Business rows
      // (ghlContactId is @unique). Catch unique-violation, log, continue.
      try {
        await saveGhlContactId(c.id, contactId);
      } catch (e: any) {
        if (/duplicate key/i.test(e.message ?? '')) {
          // Already linked from another business row sharing this email — fine.
          // Mark this row's contactId as set anyway by clearing the constraint
          // would be wrong; instead, just leave ghlContactId NULL on this row
          // (the contact still exists in GHL and is still linked to ONE company)
          console.log(`(skip dup writeback)`);
        } else throw e;
      }
    } catch (e: any) {
      failed++;
      const msg = e.message?.slice(0, 120) ?? String(e);
      failures.push({ name: c.name, error: msg });
      console.log(`✗ ${msg}`);
    }

    // Rate limit: ~600ms between operations (search + post + put chain)
    if (i + 1 < candidates.length) await sleep(700);
  }

  console.log(`\n─── Summary ───`);
  console.log(`Total:        ${candidates.length}`);
  console.log(`Created:      ${created}`);
  console.log(`Linked (existing): ${linkedExisting}`);
  console.log(`Tagged (existing): ${taggedExisting}`);
  console.log(`Failed:       ${failed}`);

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

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
