/**
 * Cold outreach to moval.living businesses with valid emails.
 *
 * Sends a CAN-SPAM-compliant email inviting the recipient to claim their
 * free listing. Each email includes:
 *   - Accurate "From" (Emma@moval.living)
 *   - Physical postal address (23110 Atlantic Circle, Suite F, Moreno Valley, CA 92553)
 *   - Working unsubscribe link (every recipient can opt out via one click)
 *   - Clear subject line
 *   - Plain-text alternative (preferring HTML when supported)
 *
 * Authentication: requires AWS_SES_SMTP_USERNAME / PASSWORD / HOST env
 * vars. Loaded from .env.local or the hermes home env.
 *
 * Idempotency: records outreach state in the BusinessAudit's
 * rawSignals.outreachSentAt + outreachMessageId so we never duplicate-send.
 *
 * Filter: only businesses with a real email (skip the 372 that have no
 * email) and where outreach has not been sent yet (or where
 * --re-send is passed).
 *
 * Usage:
 *   AWS_SES_SMTP_USERNAME=... AWS_SES_SMTP_PASSWORD=... \
 *     npx tsx scripts/outreach-cold.mts --limit=5        # smoke test
 *   AWS_SES_SMTP_USERNAME=... AWS_SES_SMTP_PASSWORD=... \
 *     npx tsx scripts/outreach-cold.mts                   # all 134
 *   --re-send                                            # skip dedupe check
 *   --dry-run                                            # print, don't send
 */

import { getPrisma } from '../src/lib/prisma';
import nodemailer from 'nodemailer';

// Reuse the env loading order from scripts/email-moval-living.js
import { config as loadEnv } from 'dotenv';
loadEnv({ path: process.env.HERMES_ENV_PATH || '.env.local' });
loadEnv({
  path:
    process.env.HERMES_GLOBAL_ENV_PATH ||
    `${process.env.USERPROFILE || process.env.HOME}/AppData/Local/hermes/profiles/molly/.env`,
});

const args = process.argv.slice(2);
const LIMIT = (() => {
  const a = args.find((x) => x.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1], 10) : null;
})();
const DRY_RUN = args.includes('--dry-run');
const RE_SEND = args.includes('--re-send');
const ONLY_HIGH_PRIORITY = args.includes('--priority');

const PHYSICAL_ADDRESS = '23110 Atlantic Circle, Suite F, Moreno Valley, CA 92553';
const FROM_NAME = 'Emma at moval.living';
const FROM_EMAIL = 'Emma@moval.living';
const REPLY_TO = 'john@menke.re';
const SITE_URL = 'https://moval.living';

async function main() {
  const SES_USER = process.env.AWS_SES_SMTP_USERNAME;
  const SES_PASS = process.env.AWS_SES_SMTP_PASSWORD;
  const SES_HOST = process.env.AWS_SES_SMTP_HOST || 'email-smtp.us-west-2.amazonaws.com';
  const SES_PORT = parseInt(process.env.AWS_SES_SMTP_PORT || '587', 10);

  if (!DRY_RUN && (!SES_USER || !SES_PASS)) {
    console.error('AWS_SES_SMTP_USERNAME / AWS_SES_SMTP_PASSWORD required');
    process.exit(1);
  }

  const p = getPrisma();

  // Load candidates (any business with a valid email — we filter
  // unsubscribed/sent below in code, since the rawSignals JSON path
  // query is unreliable across Prisma versions).
  const where: any = {
    status: 'APPROVED',
    NOT: { email: null },
  };
  const allCandidates = await p.business.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
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

  // Filter out unsubscribed and already-sent (unless --re-send)
  const candidates = RE_SEND
    ? allCandidates
    : allCandidates.filter((c) => {
        const a = c.audits[0];
        const sig = (a?.rawSignals as any) || {};
        if (sig.outreachUnsubscribedAt) return false; // they opted out
        if (sig.outreachSentAt) return false; // already contacted
        return true;
      });

  // If --priority, filter to critical-tier + email
  const filtered = ONLY_HIGH_PRIORITY
    ? candidates.filter((c) => {
        const a = c.audits[0];
        return a && a.score < 40;
      })
    : candidates;

  console.log(`\n📧 Cold outreach: ${filtered.length} candidates`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : RE_SEND ? 're-send' : 'first time'}`);
  if (ONLY_HIGH_PRIORITY) console.log('   Filter: critical tier (score < 40) only\n');

  const transporter = !DRY_RUN
    ? nodemailer.createTransport({
        host: SES_HOST!,
        port: SES_PORT,
        secure: SES_PORT === 465,
        auth: { user: SES_USER!, pass: SES_PASS! },
        tls: { rejectUnauthorized: false },
      })
    : null;

  let sent = 0;
  let failed = 0;
  const failures: { name: string; email: string; error: string }[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const c = filtered[i];
    if (!c.email) continue;

    const unsubToken = Buffer.from(`${c.id}:${c.email}`).toString('base64url');
    const unsubUrl = `${SITE_URL}/api/unsubscribe?t=${unsubToken}`;
    const claimUrl = `${SITE_URL}/claim?slug=${c.slug}`;
    const auditScore = c.audits[0]?.score;

    const subject = `Your free Moreno Valley business listing is ready to claim`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <p style="font-size: 16px; color: #1f2937; line-height: 1.6;">Hi ${c.name} team,</p>

        <p style="font-size: 16px; color: #1f2937; line-height: 1.6;">
          We've created a new Moreno Valley business directory and your business
          is already listed. Claiming your free listing lets you:
        </p>

        <ul style="font-size: 16px; color: #1f2937; line-height: 1.8;">
          <li>Update your photos, hours, and description</li>
          <li>Respond to customer reviews</li>
          <li>Get discovered by the 215,000+ residents of Moreno Valley</li>
        </ul>

        ${
          auditScore
            ? `<p style="font-size: 16px; color: #1f2937; line-height: 1.6;">
                 We also ran a free <strong>website health audit</strong> on your site
                 (${c.website ?? 'your website'}) and scored it
                 <strong>${auditScore}/100</strong>. The full report is yours
                 once you claim.
               </p>`
            : ''
        }

        <p style="margin: 24px 0;">
          <a href="${claimUrl}"
             style="display: inline-block; padding: 12px 24px; background: #007a7f; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Claim Your Free Listing →
          </a>
        </p>

        <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-top: 32px;">
          No thanks? That's fine. You can{' '}
          <a href="${unsubUrl}" style="color: #6b7280;">unsubscribe</a>{' '}
          and we won't email you again.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

        <p style="font-size: 12px; color: #9ca3af; line-height: 1.6;">
          moval.living<br />
          ${PHYSICAL_ADDRESS}<br />
          <a href="${SITE_URL}" style="color: #9ca3af;">moval.living</a> ·{' '}
          <a href="${unsubUrl}" style="color: #9ca3af;">Unsubscribe</a>
        </p>
      </div>
    `;

    const text = `Hi ${c.name} team,

We've created a new Moreno Valley business directory and your business is already listed. Claiming your free listing lets you update your photos, hours, and description, respond to customer reviews, and get discovered by the 215,000+ residents of Moreno Valley.

${auditScore ? `We also ran a free website health audit on your site (${c.website ?? 'your website'}) and scored it ${auditScore}/100. The full report is yours once you claim.\n\n` : ''}
Claim your listing: ${claimUrl}

No thanks? That's fine. Unsubscribe: ${unsubUrl}

--
moval.living
${PHYSICAL_ADDRESS}
${SITE_URL}
`;

    if (DRY_RUN) {
      console.log(`[${i + 1}/${filtered.length}] ${c.name} (${c.email})`);
      console.log(`  → would send: "${subject}"`);
      console.log(`  → claim URL: ${claimUrl}`);
      console.log(`  → unsub URL: ${unsubUrl}`);
      continue;
    }

    try {
      const info = await transporter!.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: c.email,
        replyTo: REPLY_TO,
        subject,
        text,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      // Record the audit row so we never re-send (idempotency)
      await p.businessAudit.create({
        data: {
          businessId: c.id,
          score: auditScore ?? 0,
          httpStatus: null,
          finalUrl: null,
          pageLoadMs: null,
          contentLength: null,
          rawSignals: {
            outreachSentAt: new Date().toISOString(),
            outreachMessageId: info.messageId,
            outreachChannel: 'email',
            outreachSubject: subject,
          } as any,
        },
      });

      sent++;
      console.log(`[${i + 1}/${filtered.length}] ${c.name} → ${c.email} ✓ ${info.messageId}`);
    } catch (e: any) {
      failed++;
      failures.push({ name: c.name, email: c.email, error: e.message?.slice(0, 100) });
      console.log(`[${i + 1}/${filtered.length}] ${c.name} → ${c.email} ✗ ${e.message?.slice(0, 80)}`);
    }

    // SES rate limit: 14 emails/sec for new accounts. We're well under.
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n─── Summary ───`);
  console.log(`Total:  ${filtered.length}`);
  console.log(`Sent:   ${sent}`);
  console.log(`Failed: ${failed}`);
  if (failures.length > 0) {
    console.log(`\nFailures:`);
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