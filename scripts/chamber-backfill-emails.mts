/**
 * Backfill chamber-verified emails into our DB and push to GHL.
 *
 * Source: Moreno Valley Chamber export at the path below (216 members)
 *
 * Steps:
 *   1. Parse chamber CSV with state-machine parser (handles quoted commas)
 *   2. Match each chamber row to our DB by normalized name + city,
 *      falling back to last-7 phone digits
 *   3. Save match report to docs/chamber-crossref-<date>.md (audit trail)
 *   4. Save CSV with the 5 EMAIL_MISMATCHES + 10 NOT_IN_DB rows
 *   5. For ONLY_CHAMBER_HAS_EMAIL (150): copy chamber email → Business.email
 *      ONLY where Business.email is null or empty (never overwrite)
 *   6. Skip EMAIL_MISMATCH (5): leave alone — needs human review
 *   7. Skip NOT_IN_DB (10): we don't have the business to write to
 *
 * After this script: re-run sync-ghl.mts --only-with-email to push to GHL.
 */
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const URL = "postgresql://neondb_owner:npg_RCJWsx5bg1nH@ep-summer-surf-afffty47-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const CSV_PATH = "C:/Users/john/AppData/Local/hermes/profiles/emma/cache/documents/doc_d8c156427d7b_CustomMemberReport_1843_Listing.csv";
const DOCS_DIR = path.resolve("docs");

// --- CSV parser (handles quoted fields, embedded commas, doubled quotes) ---
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else field += ch;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

// --- Normalize helpers ---
const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
const last7 = (p: string | null | undefined) => {
  if (!p) return '';
  const digits = String(p).replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-7) : digits;
};
const normEmail = (e: string | null | undefined) => (e ?? '').toLowerCase().trim();

// --- Main ---
async function main() {
  const db = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const ourBusinesses = await db.query(`
    SELECT id, name, email, phone, address, city, "ghlCompanyId"
    FROM "Business" WHERE status = 'APPROVED'
  `);
  const ourList = ourBusinesses.rows;

  const byName = new Map<string, any[]>();
  const byPhone = new Map<string, any[]>();
  for (const b of ourList) {
    const n = normName(b.name);
    if (n) { const a = byName.get(n) ?? []; a.push(b); byName.set(n, a); }
    const p = last7(b.phone);
    if (p) { const a = byPhone.get(p) ?? []; a.push(b); byPhone.set(p, a); }
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCsv(raw);
  const header = rows[0].map((h) => h.trim());
  const NAME_I = header.indexOf('Company Name');
  const PHONE_I = header.indexOf('Primary Phone');
  const EMAIL_I = header.indexOf('Email');
  const ADDR_I = header.indexOf('Physical Address 1');
  const CITY_I = header.indexOf('Physical City');
  const STATE_I = header.indexOf('Physical State');
  const ZIP_I = header.indexOf('Physical Zip');

  type C = { name: string; phone: string; email: string; address: string; city: string; state: string; zip: string };
  const chamber: C[] = rows.slice(1).map((r) => ({
    name: r[NAME_I] ?? '',
    phone: r[PHONE_I] ?? '',
    email: r[EMAIL_I] ?? '',
    address: r[ADDR_I] ?? '',
    city: r[CITY_I] ?? '',
    state: r[STATE_I] ?? '',
    zip: r[ZIP_I] ?? '',
  }));

  type R = {
    chamberName: string; chamberEmail: string; chamberPhone: string;
    dbId: string | null; dbName: string | null; dbEmail: string | null;
    outcome: string; matchedBy: 'name' | 'phone' | null;
  };
  const results: R[] = [];

  for (const c of chamber) {
    const nameKey = normName(c.name);
    let candidates = byName.get(nameKey) ?? [];
    let matchedBy: 'name' | 'phone' | null = candidates.length ? 'name' : null;
    if (!candidates.length && c.phone) {
      const pKey = last7(c.phone);
      if (pKey) {
        candidates = byPhone.get(pKey) ?? [];
        if (candidates.length) matchedBy = 'phone';
      }
    }
    let pick: any = null;
    if (candidates.length === 1) pick = candidates[0];
    else if (candidates.length > 1) {
      pick = candidates.find((b) => (b.city ?? '').toLowerCase() === c.city.toLowerCase()) ?? candidates[0];
    }
    const cEmail = normEmail(c.email);
    const dEmail = pick ? normEmail(pick.email) : '';

    let outcome: string;
    if (!pick) outcome = 'NOT_IN_DB';
    else if (!cEmail && !dEmail) outcome = 'BOTH_NO_EMAIL';
    else if (cEmail === dEmail && cEmail) outcome = 'EXACT_EMAIL_MATCH';
    else if (cEmail && dEmail) outcome = 'EMAIL_MISMATCH';
    else if (cEmail && !dEmail) outcome = 'ONLY_CHAMBER_HAS_EMAIL';
    else outcome = 'ONLY_DB_HAS_EMAIL';

    results.push({
      chamberName: c.name, chamberEmail: c.email, chamberPhone: c.phone,
      dbId: pick?.id ?? null, dbName: pick?.name ?? null, dbEmail: pick?.email ?? null,
      outcome, matchedBy,
    });
  }

  // --- Persist reports ---
  const stamp = new Date().toISOString().slice(0, 10);
  const csvOut = path.join(DOCS_DIR, `chamber-crossref-${stamp}.csv`);
  const mdOut = path.join(DOCS_DIR, `chamber-crossref-${stamp}.md`);

  // CSV with all 216 rows for full audit trail
  const csvHeader = ['outcome', 'matchedBy', 'chamberName', 'chamberEmail', 'chamberPhone', 'dbId', 'dbName', 'dbEmail'];
  const csvLines = [csvHeader.join(',')];
  for (const r of results) {
    const csvEscape = (v: string | null) => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
    csvLines.push([
      r.outcome, r.matchedBy ?? '',
      csvEscape(r.chamberName), csvEscape(r.chamberEmail), csvEscape(r.chamberPhone),
      csvEscape(r.dbId), csvEscape(r.dbName), csvEscape(r.dbEmail),
    ].join(','));
  }
  fs.writeFileSync(csvOut, csvLines.join('\n') + '\n', 'utf-8');

  // Markdown summary
  const counts = {
    total: results.length,
    EXACT_EMAIL_MATCH: results.filter((r) => r.outcome === 'EXACT_EMAIL_MATCH').length,
    EMAIL_MISMATCH: results.filter((r) => r.outcome === 'EMAIL_MISMATCH').length,
    ONLY_CHAMBER_HAS_EMAIL: results.filter((r) => r.outcome === 'ONLY_CHAMBER_HAS_EMAIL').length,
    ONLY_DB_HAS_EMAIL: results.filter((r) => r.outcome === 'ONLY_DB_HAS_EMAIL').length,
    BOTH_NO_EMAIL: results.filter((r) => r.outcome === 'BOTH_NO_EMAIL').length,
    NOT_IN_DB: results.filter((r) => r.outcome === 'NOT_IN_DB').length,
  };
  const md = [
    `# Chamber × DB Cross-Reference — ${stamp}`,
    ``,
    `Source: \`${path.basename(CSV_PATH)}\` (${counts.total} chamber members)`,
    `Target: \`moval.living\` Business table (${ourList.length} approved businesses)`,
    ``,
    `## Summary`,
    ``,
    `| Outcome | Count |`,
    `|---|---|`,
    `| Total chamber rows | ${counts.total} |`,
    `| Matched to DB | ${counts.total - counts.NOT_IN_DB} |`,
    `| EXACT_EMAIL_MATCH | ${counts.EXACT_EMAIL_MATCH} |`,
    `| EMAIL_MISMATCH (review needed) | ${counts.EMAIL_MISMATCH} |`,
    `| ONLY_CHAMBER_HAS_EMAIL (backfill candidates) | ${counts.ONLY_CHAMBER_HAS_EMAIL} |`,
    `| ONLY_DB_HAS_EMAIL | ${counts.ONLY_DB_HAS_EMAIL} |`,
    `| BOTH_NO_EMAIL | ${counts.BOTH_NO_EMAIL} |`,
    `| NOT_IN_DB (directory gaps) | ${counts.NOT_IN_DB} |`,
    ``,
    `## 🚨 EMAIL_MISMATCHES (${counts.EMAIL_MISMATCH}) — needs human review`,
    ``,
    ...results.filter((r) => r.outcome === 'EMAIL_MISMATCH').map((r) =>
      `- **${r.chamberName}** — chamber: \`${r.chamberEmail}\` | db: \`${r.dbEmail}\` (matched by ${r.matchedBy})`
    ),
    ``,
    `## 📥 NOT_IN_DB (${counts.NOT_IN_DB}) — directory gaps`,
    ``,
    ...results.filter((r) => r.outcome === 'NOT_IN_DB').map((r) =>
      `- **${r.chamberName}** — ${r.chamberPhone || '(no phone)'} | \`${r.chamberEmail || '(no email)'}\``
    ),
    ``,
    `Full per-row CSV: \`${path.basename(csvOut)}\``,
    ``,
  ].join('\n');
  fs.writeFileSync(mdOut, md, 'utf-8');

  console.log(`📄 Wrote ${csvOut}`);
  console.log(`📄 Wrote ${mdOut}\n`);

  // --- Backfill ONLY_CHAMBER_HAS_EMAIL ---
  const toFill = results.filter((r) => r.outcome === 'ONLY_CHAMBER_HAS_EMAIL' && r.dbId && r.chamberEmail);
  console.log(`📥 Backfilling ${toFill.length} chamber emails into Business.email...`);
  console.log(`   (Will only write where Business.email is NULL or empty — never overwrite)\n`);

  let written = 0;
  let skipped = 0;
  const writtenRows: { dbId: string; dbName: string; newEmail: string }[] = [];
  for (const r of toFill) {
    // Re-query the business to check current email — race-safe
    const cur = await db.query(`SELECT email FROM "Business" WHERE id = $1`, [r.dbId]);
    if (!cur.rows.length) continue;
    const curEmail = normEmail(cur.rows[0].email);
    if (curEmail) {
      skipped++;
      continue;
    }
    await db.query(
      `UPDATE "Business" SET email = $1, "updatedAt" = NOW() WHERE id = $2`,
      [r.chamberEmail, r.dbId]
    );
    written++;
    writtenRows.push({ dbId: r.dbId ?? '', dbName: r.dbName ?? '', newEmail: r.chamberEmail });
  }

  console.log(`   ✅ Wrote ${written} new emails`);
  console.log(`   ⏭️  Skipped ${skipped} (already had an email — race-safe guard worked)\n`);

  // Show a few samples
  if (writtenRows.length) {
    console.log('Sample 5 backfilled rows:');
    console.table(writtenRows.slice(0, 5));
  }

  // Verify the BOTH_NO_EMAIL count went down
  const finalCount = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::int AS has_email,
      COUNT(*) FILTER (WHERE email IS NULL OR email = '')::int AS no_email
    FROM "Business" WHERE status = 'APPROVED'
  `);
  console.log('\nFinal DB email coverage:');
  console.table(finalCount.rows[0]);

  await db.end();
  console.log(`\n👉 Next: run \`npx tsx scripts/sync-ghl.mts --only-with-email\` to push these to GHL.`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
