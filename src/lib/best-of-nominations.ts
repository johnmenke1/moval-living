/**
 * Public Best-Of nomination helpers.
 *
 * Three responsibilities, called from the POST route in this order:
 *   1. sendThankYouEmail() — fire-and-forget SES thank-you email to the
 *      nominator. Same voice as the cold-outreach templates.
 *   2. The admin notification (when a new PENDING arrives) is handled
 *      separately by the route handler — admin gets a different email
 *      with a deep link to the moderation panel.
 *
 * Anti-spam: rate-limit (5/IP/hr) + Turnstile + honeypot are enforced in
 * the route handler, not here. This module assumes validated input.
 */

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