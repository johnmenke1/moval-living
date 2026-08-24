/**
 * Public Best-Of nomination helpers.
 *
 * Three responsibilities, called from the POST route in this order:
 *   1. syncNominatorToGHL() — push the nominator to GoHighLevel as a Contact
 *      with tag 'community-member' and source 'best-of-nomination'.
 *      If the nominator DIDN'T have an account at submit-time, also
 *      tag them 'nominee-no-account' so a follow-up workflow can
 *      nudge them to register and vote. Best-effort: GHL outage
 *      must NOT block the form from saving locally.
 *   2. sendThankYouEmail() — fire-and-forget SES thank-you email to the
 *      nominator. Same voice as the cold-outreach templates.
 *   3. The admin notification (when a new PENDING arrives) is handled
 *      separately by the route handler — admin gets a different email
 *      with a deep link to the moderation panel.
 *
 * Anti-spam: rate-limit (5/IP/hr) and honeypot are enforced in the route
 * handler, not here. This module assumes validated input.
 */

import { prisma } from './prisma'

const GHL_API_BASE = 'https://services.leadconnectorhq.com'
const GHL_API_VERSION = '2021-07-28'
const COMMUNITY_MEMBER_TAG = 'community-member'
// Fired on nominators who submitted via the public form (no Owner session).
// Triggers the GHL follow-up workflow that nudges them to register so they
// can vote. NOT fired on nominations from logged-in Owners.
const NO_ACCOUNT_TAG = 'nominee-no-account'
const BEST_OF_SOURCE = 'best-of-nomination'

// ── GHL mirror ────────────────────────────────────────────────────────────

interface GhlSyncResult {
  ok: boolean
  contactId?: string
  skipped?: boolean
  reason?: string
  error?: string
}

interface NominatorInput {
  name: string
  email: string
  emailOptIn: boolean
  // Captured at submission time — used as a custom field so GHL workflows
  // can filter "this came in via the best-of nomination form".
  submittedAt: Date
  // True iff the nominator had an active Owner session at submit time.
  // Drives the `nominee-no-account` tag on the GHL contact, which
  // gates the "you should register so you can vote" follow-up workflow.
  accountCreated: boolean
}

/**
 * Push the nominator into GoHighLevel as a Contact.
 * - Search-by-email first (idempotent — re-nominating the same person
 *   doesn't create duplicates).
 * - If not found, create with the community-member tag and source.
 * - If emailOptIn is true, set the contact's marketing-consent flag;
 *   if false, leave it off (CAN-SPAM: only opt-in what they consented to).
 *
 * Returns contactId on success. Never throws — GHL outages are logged
 * and the nomination still saves locally.
 */
export async function syncNominatorToGHL(input: NominatorInput): Promise<GhlSyncResult> {
  const apiKey = process.env.GHL_API_TOKEN
  const locationId = process.env.GHL_LOCATION_ID
  if (!apiKey || !locationId) {
    return { ok: false, skipped: true, reason: 'GHL env vars not set (GHL_API_TOKEN / GHL_LOCATION_ID)' }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_API_VERSION,
    'Content-Type': 'application/json',
  }

  // Split name into first/last — same heuristic as expert-partner.ts
  const nameParts = input.name.trim().split(/\s+/)
  const firstName = nameParts[0] || input.name
  const lastName = nameParts.slice(1).join(' ') || ''

  try {
    // Step 1: search by email
    const searchUrl = `${GHL_API_BASE}/contacts/search/duplicate?locationId=${encodeURIComponent(
      locationId
    )}&email=${encodeURIComponent(input.email)}`
    const searchRes = await fetch(searchUrl, { headers })

    let contactId: string | undefined

    if (searchRes.ok) {
      const searchData = await searchRes.json()
      // GHL's duplicate-search returns { contact: {...} | null } or an array
      // depending on the endpoint variant. Handle both shapes.
      const found = Array.isArray(searchData?.contacts) ? searchData.contacts[0] : searchData?.contact
      if (found?.id) contactId = found.id
    }

    if (!contactId) {
      // Step 2: create the contact.
      // We do NOT set `marketingConsent` here — GHL's Contacts API rejects
      // it as an unknown property (422). Opt-in is recorded locally on the
      // nomination row (emailOptIn + emailConsentAt) for CAN-SPAM/10DLC
      // compliance; a downstream GHL workflow can read it from the
      // community-member tag or a custom field. The community-member tag
      // + source 'best-of-nomination' are the workflow signals.
      //
      // Tags:
      //   - 'community-member' — always, mirrors the existing behavior.
      //   - 'nominee-no-account' — only when accountCreated === false.
      //     The GHL follow-up workflow gates on this tag.
      const tags = [COMMUNITY_MEMBER_TAG]
      if (!input.accountCreated) tags.push(NO_ACCOUNT_TAG)

      const createRes = await fetch(`${GHL_API_BASE}/contacts/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          locationId,
          firstName,
          lastName,
          email: input.email,
          source: BEST_OF_SOURCE,
          tags,
        }),
      })

      if (!createRes.ok) {
        const text = await createRes.text()
        return { ok: false, error: `GHL contact create failed: ${createRes.status} ${text.slice(0, 200)}` }
      }
      const created = await createRes.json()
      contactId = created.contact?.id || created.id
    } else {
      // Existing contact — patch tags + source. (See comment above re:
      // marketingConsent — not settable via the Contacts API.)
      //
      // For existing contacts we PATCH to the full intended tag set.
      // If they later register and vote, the GHL workflow will REMOVE
      // the nominee-no-account tag (the workflow trigger handles that).
      // We always re-assert community-member so the tag is stable
      // across renominations.
      const tags = [COMMUNITY_MEMBER_TAG]
      if (!input.accountCreated) tags.push(NO_ACCOUNT_TAG)

      const patchRes = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          tags,
          source: BEST_OF_SOURCE,
        }),
      })
      // 200/201 are both success — anything else is a soft warning, the
      // local nomination is still saved.
      if (!patchRes.ok && patchRes.status !== 422) {
        console.warn(`[BestOfNomination] GHL patch on ${contactId} returned ${patchRes.status}`)
      }
    }

    return { ok: true, contactId }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Persist the GHL contactId on the nomination row so subsequent runs can
 * skip the search step.
 */
export async function attachGhlContactId(nominationId: string, contactId: string): Promise<void> {
  await prisma.bestOfNomination.update({
    where: { id: nominationId },
    data: { ghlContactId: contactId, ghlSyncedAt: new Date() },
  })
}

// ── Thank-you email ───────────────────────────────────────────────────────

interface ThankYouInput {
  toName: string
  toEmail: string
  businessName: string
  categoryName: string
  reason: string
}

/**
 * Send a thank-you email to the nominator. Same voice as the cold-outreach
 * templates (Hi first-name, "Cheers" signoff, "moval.living — Moreno
 * Valley's Community Business Directory" tagline). CAN-SPAM-compliant
 * footer with opt-out.
 *
 * Returns true on success, false on any failure (never throws — the form
 * has already saved locally at this point).
 */
export async function sendThankYouEmail(input: ThankYouInput): Promise<boolean> {
  const sesHost = process.env.AWS_SES_SMTP_HOST
  const sesUser = process.env.AWS_SES_SMTP_USERNAME
  const sesPass = process.env.AWS_SES_SMTP_PASSWORD
  const from = process.env.AUTH_EMAIL_FROM || 'MovalLiving <noreply@moval.living>'

  if (!sesHost || !sesUser || !sesPass) {
    console.log('[BestOfNomination] SES env vars missing — skipping thank-you email')
    return false
  }

  const nodemailer = await import('nodemailer').catch(() => null)
  if (!nodemailer) {
    console.log('[BestOfNomination] nodemailer not installed — skipping thank-you email')
    return false
  }

  const firstName = input.toName.trim().split(/\s+/)[0] || input.toName
  const subject = `Thanks for the nomination — we'll take a look 👀`

  const text = `Hi ${firstName},

Thanks for taking the time to nominate ${input.businessName} for "${input.categoryName}" — it means a lot when locals share what they love about Moreno Valley.

You wrote:
"${input.reason}"

Our editors review every nomination personally. If we move forward with ${input.businessName}, you'll see it on https://www.moval.living/best-of — and we'll let you know.

Either way, you just became a member of the moval.living community. We're building this directory with help from people like you, so thanks for being part of it.

Cheers,
Emma
moval.living — Moreno Valley's Community Business Directory

---
You received this because you submitted a Best Of nomination. If you'd like to stop receiving these messages, reply "unsubscribe" and we'll take you off the list.
`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <tr>
        <td style="background:#1a56db;padding:32px 40px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700">Moval<span style="color:#93c5fd">.living</span></h1>
        </td>
      </tr>
      <tr>
        <td style="padding:40px">
          <p style="margin:0 0 20px;color:#111827;font-size:16px;line-height:1.6">Hi ${escapeHtml(firstName)},</p>
          <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6">
            Thanks for taking the time to nominate <strong>${escapeHtml(input.businessName)}</strong> for
            <strong>"${escapeHtml(input.categoryName)}"</strong> — it means a lot when locals share what they love about Moreno Valley.
          </p>
          <p style="margin:0 0 12px;color:#6b7280;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">You wrote</p>
          <blockquote style="margin:0 0 24px;padding:16px 20px;background:#f9fafb;border-left:3px solid #1a56db;color:#374151;font-style:italic;font-size:15px;line-height:1.6;border-radius:0 8px 8px 0">
            "${escapeHtml(input.reason)}"
          </blockquote>
          <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6">
            Our editors review every nomination personally. If we move forward with
            ${escapeHtml(input.businessName)}, you'll see it on
            <a href="https://www.moval.living/best-of" style="color:#1a56db;text-decoration:none;font-weight:600">moval.living/best-of</a>
            — and we'll let you know.
          </p>
          <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6">
            Either way, you just became a member of the moval.living community. We're building this directory with help from people like you, so thanks for being part of it.
          </p>
          <p style="margin:0;color:#374151;font-size:16px;line-height:1.6">Cheers,<br /><strong>Emma</strong><br /><span style="color:#6b7280;font-size:14px">moval.living — Moreno Valley's Community Business Directory</span></p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 40px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5">
            You received this because you submitted a Best Of nomination. If you'd like to stop receiving these messages, reply "unsubscribe" and we'll take you off the list.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  try {
    const transporter = nodemailer.createTransport({
      host: sesHost,
      port: 587,
      secure: false,
      auth: { user: sesUser, pass: sesPass },
    })
    await transporter.sendMail({ from, to: input.toEmail, subject, text, html })
    return true
  } catch (e) {
    console.error('[BestOfNomination] SES thank-you failed:', e)
    return false
  }
}

// ── Admin notification ────────────────────────────────────────────────────

// Default admin email — Johnny (MoVal.living@gmail.com). Override via
// ADMIN_NOTIFY_EMAIL env var if you ever need to route to a different inbox
// (e.g. a shared notify@ alias for a future team).
const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || 'MoVal.living@gmail.com'

interface AdminNotifyInput {
  nominationId: string
  nominatorName: string
  businessName: string
  categoryName: string
  adminLink: string
}

/**
 * Email the admin when a new PENDING nomination lands. Plain-text only —
 * keeps it short, includes a deep link to the moderation row.
 */
export async function notifyAdminOfNomination(input: AdminNotifyInput): Promise<boolean> {
  const sesHost = process.env.AWS_SES_SMTP_HOST
  const sesUser = process.env.AWS_SES_SMTP_USERNAME
  const sesPass = process.env.AWS_SES_SMTP_PASSWORD
  const from = process.env.AUTH_EMAIL_FROM || 'MovalLiving <noreply@moval.living>'

  if (!sesHost || !sesUser || !sesPass) {
    console.log('[BestOfNomination] SES env vars missing — skipping admin notification')
    return false
  }

  const nodemailer = await import('nodemailer').catch(() => null)
  if (!nodemailer) return false

  const subject = `New Best-Of nomination: ${input.businessName}`

  const text = `New nomination submitted.

Business: ${input.businessName}
Suggested category: ${input.categoryName}
Nominator: ${input.nominatorName}

Moderate it here:
${input.adminLink}

— moval.living system
`

  try {
    const transporter = nodemailer.createTransport({
      host: sesHost,
      port: 587,
      secure: false,
      auth: { user: sesUser, pass: sesPass },
    })
    await transporter.sendMail({ from, to: ADMIN_EMAIL, subject, text })
    return true
  } catch (e) {
    console.error('[BestOfNomination] admin notification failed:', e)
    return false
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}