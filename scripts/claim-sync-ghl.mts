/**
 * GHL tag sync for claim events and opt-in events.
 *
 * Triggered by:
 *   1. Manual run: `npx tsx scripts/claim-sync-ghl.mts`
 *      Iterates owned businesses, syncs tags to GHL contact.
 *   2. Webhook (future): claim-complete page calls this script after a
 *      claim is recorded.
 *
 * What it does:
 *   For each Business with an owner + email:
 *     1. Look up GHL contact by email
 *     2. If found:
 *        - Add tags: moval-living-listing-claimed, moval-living-opt-in (if owner.emailOptIn)
 *        - Remove tag: moval-living-cold-outreach (no longer "cold")
 *     3. If not found, log a warning (cold outreach script handles this)
 *
 * Why tags instead of just custom fields:
 *   - GHL workflows trigger on tags
 *   - The "listing-claimed + opt-in" workflow sends the website audit report
 *     + Expert Partner upsell (that you build in GHL UI)
 */

const GHL_TOKEN = process.env.GHL_API_TOKEN;
const GHL_LOC = process.env.GHL_LOCATION_ID;
if (!GHL_TOKEN || !GHL_LOC) {
  console.error('GHL_API_TOKEN and GHL_LOCATION_ID required');
  process.exit(1);
}

import { getPrisma } from '../src/lib/prisma';

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

async function findContactByEmail(email: string): Promise<{ id: string; tags: string[] } | null> {
  const data = await gh(`/contacts/?locationId=${GHL_LOC}&email=${encodeURIComponent(email)}&limit=1`);
  if (data.contacts && data.contacts.length > 0) {
    const c = data.contacts[0];
    return { id: c.id, tags: c.tags || [] };
  }
  return null;
}

async function syncTags(contactId: string, currentTags: string[], addTags: string[], removeTags: string[]) {
  const newTags = Array.from(
    new Set([
      ...currentTags.filter((t) => !removeTags.includes(t)),
      ...addTags,
    ])
  );
  if (newTags.length === currentTags.length && newTags.every((t, i) => t === currentTags[i])) {
    return false; // no change
  }
  await gh(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify({ tags: newTags }),
  });
  return true;
}

async function main() {
  const p = getPrisma();

  // Find all businesses with an owner who has opted in.
  // The owner is the canonical source of opt-in (the business track record
  // pre-claim is just an audit trail; the owner's choice at claim is what
  // counts).
  const owned = await p.business.findMany({
    where: {
      status: 'APPROVED',
      NOT: { ownerId: null, email: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      owner: { select: { emailOptIn: true, smsOptIn: true } },
    },
  });

  console.log(`\n🔗 Syncing ${owned.length} owned businesses to GHL…\n`);

  let synced = 0;
  let skipped = 0;
  let failed = 0;
  const failures: { name: string; email: string; error: string }[] = [];

  for (const b of owned) {
    if (!b.email) continue;

    process.stdout.write(`  ${b.name} (${b.email})… `);

    try {
      const contact = await findContactByEmail(b.email);
      if (!contact) {
        console.log('no contact in GHL (skipping)');
        skipped++;
        continue;
      }

      const addTags = ['moval-living-listing-claimed'];
      if (b.owner?.emailOptIn) addTags.push('moval-living-opt-in');
      const removeTags = ['moval-living-cold-outreach'];

      const changed = await syncTags(contact.id, contact.tags, addTags, removeTags);
      console.log(changed ? '✓ updated' : '✓ checked (no change)');
      synced++;
    } catch (e: any) {
      failed++;
      failures.push({ name: b.name, email: b.email, error: e.message?.slice(0, 100) });
      console.log(`✗ ${e.message?.slice(0, 80)}`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n─── Summary ───`);
  console.log(`Total:   ${owned.length}`);
  console.log(`Synced:  ${synced}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed:  ${failed}`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.slice(0, 10).forEach((f) =>
      console.log(`  ${f.name} (${f.email}): ${f.error}`)
    );
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});