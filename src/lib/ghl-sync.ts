/**
 * Shared GHL sync logic — used by both scripts/sync-ghl.mts (manual CLI)
 * and src/app/api/cron/sync-ghl/route.ts (Vercel Cron).
 *
 * Single source of truth for the business → GHL Company field mapping and
 * the upsert flow. Anything that needs to push businesses to GHL should
 * call syncBusinessesToGhl() below.
 *
 * Token comes from process.env.GHL_API_TOKEN (set in .env.live for local,
 * Vercel project env for prod). Location ID from process.env.GHL_LOCATION_ID.
 */

import { getPrisma } from './prisma';
import { Client } from 'pg';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

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

function sqlEscape(value: string | null | undefined): string {
  if (value == null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
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
  // Normalize website — must include protocol for GHL to render it
  let website = business.website;
  if (website && !/^https?:\/\//i.test(website)) {
    website = `https://${website}`;
  }

  // Normalize phone — strip non-digits except + leading char
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

  // Drop empty strings (GHL rejects them on some fields)
  for (const k of Object.keys(body) as (keyof GhCompany)[]) {
    if (body[k] === '') body[k] = null as any;
  }

  let res: Response;
  if (business.ghlCompanyId) {
    // Update existing
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
    // If 404 (GHL deleted the record), fall through to POST
    if (res.status !== 404) {
      const txt = await res.text();
      throw new Error(`PUT ${res.status}: ${txt.slice(0, 200)}`);
    }
  }

  // Create new (or re-create after 404)
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
    // Rate limit: 700ms between calls = ~85/min, well under 100/min limit
    if (i + 1 < candidates.length) await sleep(700);
  }

  await p.$disconnect();

  return { total: candidates.length, created, updated, failed, failures, processed };
}
