/**
 * Shared GHL sync logic — used by both scripts/sync-ghl.mts (manual CLI),
 * scripts/sync-ghl-contacts.mts (manual CLI), and
 * src/app/api/cron/sync-ghl/route.ts (Vercel Cron).
 *
 * Single source of truth for the business → GHL Company and
 * business → GHL Contact mappings. Anything that needs to push
 * businesses to GHL should call syncBusinessesToGhl() or
 * syncContactsToGhl() below.
 *
 * Token comes from process.env.GHL_API_TOKEN (set in .env.live for local,
 * Vercel project env for prod). Location ID from process.env.GHL_LOCATION_ID.
 */

import { getPrisma } from './prisma';
import { Client } from 'pg';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const TAG = 'movalliving-cold-outreach';

function sqlEscape(value: string | null | undefined): string {
  if (value == null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ghlHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Version: GHL_API_VERSION,
    'Content-Type': 'application/json',
  };
}

// =====================================================================
// Companies sync
// =====================================================================

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

export interface SyncFilters {
  // Only include businesses that don't have a ghlCompanyId yet
  onlyMissing?: boolean;
  // Only include businesses that have an email set
  onlyWithEmail?: boolean;
  // Cap on how many to process (null = no cap)
  limit?: number | null;
}

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  failures: { name: string; error: string }[];
  // Per-business results — useful for logging/debugging
  processed: { name: string; action: 'created' | 'updated' | 'failed'; ghlId?: string; error?: string }[];
}

async function saveGhlId(businessId: string, ghlCompanyId: string, locationId: string) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      `UPDATE "Business" SET "ghlCompanyId" = ${sqlEscape(ghlCompanyId)}, "ghlLocationId" = ${sqlEscape(locationId)}, "updatedAt" = NOW() WHERE id = ${sqlEscape(businessId)}`
    );
  } finally {
    await client.end();
  }
}

async function ghlUpsert(
  token: string,
  locationId: string,
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
  let website = business.website;
  if (website && !/^https?:\/\//i.test(website)) {
    website = `https://${website}`;
  }

  let phone = business.phone;
  if (phone) {
    const cleaned = phone.replace(/[^\d+()\-. ]/g, '').trim();
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

  for (const k of Object.keys(body) as (keyof GhCompany)[]) {
    if (body[k] === '') body[k] = null as any;
  }

  let res: Response;
  if (business.ghlCompanyId) {
    res = await fetch(`${GHL_API_BASE}/businesses/${business.ghlCompanyId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Version: GHL_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return { ghlId: business.ghlCompanyId, action: 'updated' };
    }
    if (res.status !== 404) {
      const txt = await res.text();
      throw new Error(`PUT ${res.status}: ${txt.slice(0, 200)}`);
    }
  }

  res = await fetch(`${GHL_API_BASE}/businesses/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locationId, ...body }),
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

/**
 * Sync moval.living businesses → GHL Companies.
 *
 * Returns a summary of what was done. Safe to call from both serverless
 * routes (Vercel Cron) and CLI scripts.
 */
export async function syncBusinessesToGhl(filters: SyncFilters = {}): Promise<SyncResult> {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token) throw new Error('GHL_API_TOKEN not set');
  if (!locationId) throw new Error('GHL_LOCATION_ID not set');

  const p = getPrisma();

  const where: any = {
    status: 'APPROVED',
    OR: [
      { phone: { not: null } },
      { email: { not: null } },
      { website: { not: null } },
      { address: { not: '' } },
    ],
  };
  if (filters.onlyMissing) {
    where.ghlCompanyId = null;
  }
  if (filters.onlyWithEmail) {
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
    take: filters.limit ?? undefined,
  });

  let created = 0;
  let updated = 0;
  let failed = 0;
  const failures: { name: string; error: string }[] = [];
  const processed: SyncResult['processed'] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    try {
      const result = await ghlUpsert(token, locationId, c);
      await saveGhlId(c.id, result.ghlId, locationId);
      if (result.action === 'created') created++;
      else updated++;
      processed.push({ name: c.name, action: result.action, ghlId: result.ghlId });
    } catch (e: any) {
      failed++;
      const msg = e.message?.slice(0, 120) ?? String(e);
      failures.push({ name: c.name, error: msg });
      processed.push({ name: c.name, action: 'failed', error: msg });
    }
    if (i + 1 < candidates.length) await sleep(700);
  }

  await p.$disconnect();

  return { total: candidates.length, created, updated, failed, failures, processed };
}

// =====================================================================
// Contacts sync
// =====================================================================

export interface SyncContactsResult {
  total: number;
  created: number;
  linkedExisting: number;
  taggedExisting: number;
  urlsWritten: number;
  failed: number;
  failures: { name: string; error: string }[];
  processed: { name: string; action: 'created' | 'linked' | 'tagged' | 'url-written' | 'failed'; ghlId?: string; error?: string }[];
}

export interface SyncContactsFilters {
  // Only include businesses that have ghlCompanyId AND email but no ghlContactId
  onlyMissing?: boolean;
  // Cap on how many to process
  limit?: number | null;
}

async function saveGhlContactId(businessId: string, ghlContactId: string): Promise<void> {
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

async function findContactByEmail(token: string, locationId: string, email: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/search`, {
    method: 'POST',
    headers: ghlHeaders(token),
    body: JSON.stringify({
      locationId,
      page: 0,
      pageLimit: 5,
      filters: [{ field: 'email', operator: 'eq', value: email }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { contacts?: { id: string; email?: string }[] };
  const hit = data.contacts?.find((c) => c.email?.toLowerCase() === email.toLowerCase());
  return hit?.id ?? null;
}

async function createContact(
  token: string,
  locationId: string,
  b: { name: string; email: string; phone: string | null }
): Promise<string> {
  const cleanEmail = b.email.includes('@') && !b.email.includes('/') ? b.email : null;
  if (!cleanEmail) throw new Error(`POST /contacts/ invalid email: ${JSON.stringify(b.email)}`);

  const body = {
    locationId,
    firstName: 'Team',
    lastName: b.name,
    email: cleanEmail,
    phone: b.phone ?? undefined,
    tags: [TAG],
    source: 'movalliving bulk import',
  };
  const res = await fetch(`${GHL_API_BASE}/contacts/`, {
    method: 'POST',
    headers: ghlHeaders(token),
    body: JSON.stringify(body),
  });
  if (res.status === 400) {
    const txt = await res.text();
    if (/duplicated contacts/i.test(txt)) {
      const existing = await findContactByEmail(token, locationId, cleanEmail);
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

async function linkContactToCompany(token: string, contactId: string, companyId: string): Promise<void> {
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: ghlHeaders(token),
    body: JSON.stringify({ businessId: companyId }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT /contacts/${contactId} businessId ${res.status}: ${txt.slice(0, 200)}`);
  }
}

async function getContactTags(token: string, locationId: string, contactId: string): Promise<string[]> {
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}?locationId=${locationId}`, {
    headers: ghlHeaders(token),
  });
  if (!res.ok) return [];
  const data = await res.json() as { contact?: { tags?: string[] }; tags?: string[] };
  return data.contact?.tags ?? data.tags ?? [];
}

async function updateContactTags(token: string, contactId: string, currentTags: string[]): Promise<void> {
  if (currentTags.includes(TAG)) return;
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: ghlHeaders(token),
    body: JSON.stringify({ tags: [...currentTags, TAG] }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT /contacts/${contactId} tags ${res.status}: ${txt.slice(0, 200)}`);
  }
}

async function discoverListingUrlFieldId(token: string, locationId: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/locations/${locationId}/customFields`, {
    headers: ghlHeaders(token),
  });
  if (!res.ok) return null;
  const data = await res.json() as { customFields?: { id: string; fieldKey: string }[] };
  const f = (data.customFields ?? []).find((x) => x.fieldKey === 'contact.movalliving_listing_url');
  return f?.id ?? null;
}

function listingUrlFor(slug: string): string {
  return `https://www.moval.living/business/${slug}`;
}

async function writeListingUrl(token: string, contactId: string, fieldId: string, slug: string): Promise<void> {
  const url = listingUrlFor(slug);
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: ghlHeaders(token),
    body: JSON.stringify({ customFields: [{ id: fieldId, value: url }] }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT listingUrl ${res.status}: ${txt.slice(0, 200)}`);
  }
}

/**
 * Sync moval.living businesses-with-email → GHL Contacts.
 *
 * For each business with email + ghlCompanyId but no ghlContactId:
 *   1. Search GHL by email — reuse if found
 *   2. POST to create if no match (firstName="Team", lastName=<business>)
 *   3. PUT to link businessId
 *   4. PUT to ensure tag is set
 *   5. PUT to set movalliving_listing_url custom field
 *   6. Save GHL contactId back to Business.ghlContactId
 *
 * Handles duplicate-email rows gracefully: only the first Business row
 * sharing an email gets ghlContactId (the field is @unique).
 *
 * Returns a summary of what was done.
 */
export async function syncContactsToGhl(filters: SyncContactsFilters = {}): Promise<SyncContactsResult> {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token) throw new Error('GHL_API_TOKEN not set');
  if (!locationId) throw new Error('GHL_LOCATION_ID not set');

  const listingUrlFieldId = await discoverListingUrlFieldId(token, locationId);

  const p = getPrisma();

  const where: any = {
    status: 'APPROVED',
    email: { not: null },
    ghlCompanyId: { not: null },
  };
  if (filters.onlyMissing) {
    where.ghlContactId = null;
  }

  const candidates = await p.business.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      ghlCompanyId: true,
      ghlContactId: true,
    },
    orderBy: { name: 'asc' },
    take: filters.limit ?? undefined,
  });

  let created = 0;
  let linkedExisting = 0;
  let taggedExisting = 0;
  let urlsWritten = 0;
  let failed = 0;
  const failures: { name: string; error: string }[] = [];
  const processed: SyncContactsResult['processed'] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.email || !c.ghlCompanyId) continue;

    try {
      let contactId = await findContactByEmail(token, locationId, c.email);

      if (contactId) {
        linkedExisting++;
        processed.push({ name: c.name, action: 'linked', ghlId: contactId });
      } else {
        contactId = await createContact(token, locationId, {
          name: c.name,
          email: c.email,
          phone: c.phone,
        });
        created++;
        processed.push({ name: c.name, action: 'created', ghlId: contactId });
        await sleep(300);
      }

      await linkContactToCompany(token, contactId, c.ghlCompanyId);

      const currentTags = await getContactTags(token, locationId, contactId);
      if (!currentTags.includes(TAG)) {
        await updateContactTags(token, contactId, currentTags);
        taggedExisting++;
      }

      if (listingUrlFieldId && c.slug) {
        await writeListingUrl(token, contactId, listingUrlFieldId, c.slug);
        urlsWritten++;
      }

      try {
        await saveGhlContactId(c.id, contactId);
      } catch (e: any) {
        if (!/duplicate key/i.test(e.message ?? '')) throw e;
      }
    } catch (e: any) {
      failed++;
      const msg = e.message?.slice(0, 120) ?? String(e);
      failures.push({ name: c.name, error: msg });
      processed.push({ name: c.name, action: 'failed', error: msg });
    }

    if (i + 1 < candidates.length) await sleep(700);
  }

  await p.$disconnect();

  return { total: candidates.length, created, linkedExisting, taggedExisting, urlsWritten, failed, failures, processed };
}
