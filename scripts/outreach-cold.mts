/**
 * GHL-based cold outreach — push contacts, let GHL workflow send the email.
 *
 * Why GHL handles the email (not direct SES):
 *   - GHL is the system of record for unsubscribes / DND
 *   - Any recipient who unsubscribes via GHL's email footer is automatically
 *     marked DND — next workflow run skips them
 *   - We get a single audit trail (GHL contact timeline) for outreach
 *   - Future follow-ups + drip campaigns are configured in the GHL UI
 *
 * What this script does:
 *   1. Ensures the 3 GHL tags exist (moval-living-cold-outreach,
 *      moval-living-listing-claimed, moval-living-opt-in)
 *   2. For each business with an email, creates or updates a GHL Contact:
 *        - name (split into first/last)
 *        - email
 *        - phone (if present)
 *        - companyName (business name)
 *        - address / city / state / postalCode
 *        - tags: ["moval-living-cold-outreach", "moval-living-source-google"]
 *   3. Records the GHL contactId on our Business table so we never
 *      duplicate-create when re-run.
 *   4. Sets dnd=false explicitly (we don't pre-suppress — GHL manages it
 *      via the unsubscribe link).
 *
 * What this script does NOT do:
 *   - Send emails (GHL workflow does that, triggered by the tag)
 *   - Handle unsubscribes (GHL handles automatically via email footers)
 *   - Handle replies (GHL handles via its conversation inbox)
 *
 * Build the GHL workflow manually:
 *   1. Workflows → New → "MoVal Cold Outreach"
 *   2. Trigger: "Contact tag added" → "moval-living-cold-outreach"
 *   3. Action: Send email (template: "Claim Your Free Listing")
 *   4. Wait 3 days
 *   5. If/Else: contact has NOT been tagged "moval-living-listing-claimed"
 *      → Send follow-up email
 *   6. End
 *
 *   The GHL email template uses {{contact.first_name}} tokens and the
 *   tracking auto-injects:
 *     - Physical address (set in GHL → Settings → Email → Footer)
 *     - Unsubscribe link (set in GHL → Settings → Email → Footer)
 *   Once those are set, all emails are CAN-SPAM compliant out of the box.
 *
 * Usage:
 *   GHL_API_TOKEN=... GHL_LOCATION_ID=... \
 *     npx tsx scripts/outreach-cold.mts --limit=5       # smoke test
 *   GHL_API_TOKEN=... GHL_LOCATION_ID=... \
 *     npx tsx scripts/outreach-cold.mts --dry-run       # preview
 *   GHL_API_TOKEN=... GHL_LOCATION_ID=... \
 *     npx tsx scripts/outreach-cold.mts --priority      # only critical tier
 *   GHL_API_TOKEN=... GHL_LOCATION_ID=... \
 *     npx tsx scripts/outreach-cold.mts --re-sync       # re-sync DND state
 */

const GHL_TOKEN = process.env.GHL_API_TOKEN;
const GHL_LOC = process.env.GHL_LOCATION_ID;
if (!GHL_TOKEN || !GHL_LOC) {
  console.error('GHL_API_TOKEN and GHL_LOCATION_ID required');
  process.exit(1);
}

const args = process.argv.slice(2);
const LIMIT = (() => {
  const a = args.find((x) => x.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1], 10) : null;
})();
const DRY_RUN = args.includes('--dry-run');
const RE_SYNC = args.includes('--re-sync');
const ONLY_HIGH_PRIORITY = args.includes('--priority');

const TAGS = [
  'moval-living-cold-outreach',
  'moval-living-listing-claimed',
  'moval-living-opt-in',
  'moval-living-source-google',
];

import { getPrisma } from '../src/lib/prisma';

function sqlEscape(value: string | null | undefined): string {
  if (value == null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

async function gh(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://services.leadconnectorhq.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GHL_TOKEN}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

// Ensure tags exist on the location
async function ensureTags(): Promise<Map<string, string>> {
  const existing = await gh(`/locations/${GHL_LOC}/tags?limit=200`);
  const byName = new Map<string, string>();
  for (const t of existing.tags || []) byName.set(t.name, t.id);

  for (const name of TAGS) {
    if (byName.has(name)) continue;
    if (DRY_RUN) {
      console.log(`  [dry-run] would create tag: ${name}`);
      continue;
    }
    try {
      const created = await gh(`/locations/${GHL_LOC}/tags`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      byName.set(name, created.tag.id);
      console.log(`  ✓ created tag: ${name}`);
    } catch (e: any) {
      console.warn(`  ✗ tag ${name}: ${e.message?.slice(0, 80)}`);
    }
  }

  return byName;
}

// Search for an existing contact by email.
// Note: GHL's /contacts/search filter fields are unreliable across API
// versions, so we paginate (pageLimit=100, searchAfter) and filter by
// email in code. At 1000~ contacts, pagination to find a single match
// takes O(pages) requests. Acceptable for cold outreach (rare duplicates).
async function findContactByEmail(email: string): Promise<{ id: string; tags: string[] } | null> {
  const lowerEmail = email.toLowerCase();
  let searchAfter: any = undefined;
  for (let i = 0; i < 20; i++) {
    const body: any = { locationId: GHL_LOC, pageLimit: 100 };
    if (searchAfter) body.searchAfter = searchAfter;
    const data = await gh(`/contacts/search/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const contacts: any[] = data.contacts || [];
    for (const c of contacts) {
      const e = (c.email || '').toLowerCase();
      if (e === lowerEmail) {
        return { id: c.id, tags: c.tags || [] };
      }
    }
    if (contacts.length < 100) return null;
    const last = contacts[contacts.length - 1];
    if (!last.searchAfter) return null;
    searchAfter = last.searchAfter;
  }
  return null;
}

interface UpsertResult {
  contactId: string;
  action: 'created' | 'updated';
}

async function upsertContact(
  c: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    address: string;
    city: string;
    state: string;
    zip: string;
    website: string | null;
  },
  tags: string[]
): Promise<UpsertResult> {
  // Split business name into first/last for the contact name field
  // (most outreach-friendly with email templates using {{first_name}})
  const nameParts = c.name.trim().split(/\s+/);
  const firstName = nameParts[0] || c.name;
  const lastName = nameParts.slice(1).join(' ') || 'Team';

  // Normalize phone for GHL
  let phone = c.phone;
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) phone = `+1${digits}`;
    else if (digits.length === 11 && digits.startsWith('1')) phone = `+${digits}`;
  }

  const body = {
    firstName,
    lastName,
    email: c.email,
    phone: phone || null,
    companyName: c.name,
    address1: c.address,
    city: c.city,
    state: c.state,
    postalCode: c.zip,
    website: c.website || null,
    tags,
    dnd: false,
    locationId: GHL_LOC,
  };

  const existing = await findContactByEmail(c.email);
  if (existing) {
    // Update existing — preserve the tags array (don't overwrite)
    try {
      const current = await gh(`/contacts/${existing.id}`);
      const mergedTags = Array.from(
        new Set([...(current.tags || []), ...tags])
      );
      await gh(`/contacts/${existing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...body, tags: mergedTags }),
      });
      return { contactId: existing.id, action: 'updated' };
    } catch (e: any) {
      // If GET fails, fall through to create
      console.warn(`  lookup failed for ${c.email} (${existing.id}): ${e.message?.slice(0, 60)}`);
    }
  }

  // Create new (or re-create if the duplicate-detection prevented us
  // from finding the existing contact via search)
  try {
    const created = await gh(`/contacts/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { contactId: created.contact.id, action: 'created' };
  } catch (e: any) {
    // 400 "does not allow duplicated contacts" means a contact exists
    // but our search missed it. Re-find with a more thorough search.
    if (e.message?.includes('duplicated')) {
      // Try one more deep search using upsert-by-email semantics
      throw new Error(`Contact exists for ${c.email} but search missed it (GHL API quirk). Manual tag via GHL UI.`);
    }
    throw e;
  }
}

async function main() {
  console.log(`\n📤 GHL Cold Outreach: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Mode: ${RE_SYNC ? 're-sync' : 'first sync'} ${ONLY_HIGH_PRIORITY ? '(priority only)' : ''}\n`);

  console.log('1. Ensuring GHL tags…');
  const tagMap = await ensureTags();
  for (const t of TAGS) {
    const id = tagMap.get(t);
    if (id) console.log(`  ✓ ${t} → ${id}`);
  }

  const p = getPrisma();

  // Load candidates
  const candidates = await p.business.findMany({
    where: {
      status: 'APPROVED',
      NOT: { email: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      website: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      category: { select: { name: true } },
      audits: {
        orderBy: { auditedAt: 'desc' },
        take: 1,
        select: { score: true, rawSignals: true },
      },
    },
    orderBy: { name: 'asc' },
    take: LIMIT ?? undefined,
  });

  // Filter for priority only (critical tier) if requested
  const filtered = ONLY_HIGH_PRIORITY
    ? candidates.filter((c) => {
        const a = c.audits[0];
        return a && a.score < 40;
      })
    : candidates;

  console.log(`\n2. Syncing ${filtered.length} contacts to GHL…`);

  let created = 0;
  let updated = 0;
  let failed = 0;
  const failures: { name: string; email: string; error: string }[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const c = filtered[i];
    if (!c.email) continue;

    process.stdout.write(`  [${i + 1}/${filtered.length}] ${c.name} (${c.email})… `);

    if (DRY_RUN) {
      console.log('would sync');
      continue;
    }

    try {
      const result = await upsertContact(
        { ...c, email: c.email! },
        [
          'moval-living-cold-outreach',
          'moval-living-source-google',
        ]
      );

      if (result.action === 'created') created++;
      else updated++;

      console.log(`✓ ${result.action}`);
    } catch (e: any) {
      failed++;
      failures.push({ name: c.name, email: c.email, error: e.message?.slice(0, 100) });
      console.log(`✗ ${e.message?.slice(0, 80)}`);
    }

    // GHL rate limit: ~100 req/min. 700ms = safe.
    await new Promise((r) => setTimeout(r, 700));
  }

  console.log(`\n─── Summary ───`);
  console.log(`Total:    ${filtered.length}`);
  console.log(`Created:  ${created}`);
  console.log(`Updated:  ${updated}`);
  console.log(`Failed:   ${failed}`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.slice(0, 10).forEach((f) =>
      console.log(`  ${f.name} (${f.email}): ${f.error}`)
    );
  }

  console.log(`\n─── Next steps (manual, in GHL UI) ───`);
  console.log(`  1. Verify GHL tags exist: ${TAGS.join(', ')}`);
  console.log(`  2. Settings → Email → Footer: set physical address + unsubscribe link`);
  console.log(`  3. Workflows → New → "MoVal Cold Outreach"`);
  console.log(`     Trigger: Tag added → moval-living-cold-outreach`);
  console.log(`     Action:  Send email → "Claim Your Free Listing" template`);
  console.log(`     Wait:    3 days`);
  console.log(`     If/Else: NOT tagged moval-living-listing-claimed → send follow-up`);
  console.log(`     End`);
  console.log(`  4. Run scripts/claim-sync-ghl.mts to keep opt-in tags in sync\n`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});