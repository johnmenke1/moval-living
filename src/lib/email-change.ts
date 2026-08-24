/**
 * SES email helper for the email-change confirmation flow.
 *
 * Sends a plain, text-and-HTML message to the NEW email address
 * with a confirmation link. Fire-and-forget — caller does NOT wait
 * on the result and treats failures as recoverable (the user can
 * re-request).
 *
 * Mirrors the SES SMTP pattern from src/lib/best-of-nominations.ts
 * (nodemailer + SES SMTP creds from env). AWS_SES_SMTP_HOST,
 * AWS_SES_SMTP_USERNAME, AWS_SES_SMTP_PASSWORD, AUTH_EMAIL_FROM.
 */

export interface EmailChangeConfirmationInput {
  toEmail: string
  toName: string
  confirmationUrl: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendEmailChangeConfirmationEmail(
  input: EmailChangeConfirmationInput,
): Promise<boolean> {
  const sesHost = process.env.AWS_SES_SMTP_HOST
  const sesUser = process.env.AWS_SES_SMTP_USERNAME
  const sesPass = process.env.AWS_SES_SMTP_PASSWORD
  const from =
    process.env.AUTH_EMAIL_FROM || 'MovalLiving <noreply@moval.living>'

  if (!sesHost || !sesUser || !sesPass) {
    console.log(
      '[EmailChange] SES env vars missing — skipping confirmation email',
    )
    return false
  }

  const nodemailer = await import('nodemailer').catch(() => null)
  if (!nodemailer) {
    console.log(
      '[EmailChange] nodemailer not installed — skipping confirmation email',
    )
    return false
  }

  const firstName = input.toName.trim().split(/\s+/)[0] || 'there'
  const subject = 'Confirm your new email on Moval.Living'

  const text = `Hi ${firstName},

You (or someone using your email) asked to change the email address on your Moval.Living account to this one.

If this was you, click the link below within the next hour to confirm:

${input.confirmationUrl}

If you didn't request this, you can safely ignore this email — your current email on file will not change.

Cheers,
Moval.Living
`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
      <tr>
        <td style="background:#007a7f;padding:32px 40px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700">Moval<span style="color:#93c5fd">.living</span></h1>
        </td>
      </tr>
      <tr>
        <td style="padding:40px">
          <p style="margin:0 0 20px;color:#111827;font-size:16px;line-height:1.6">Hi ${escapeHtml(firstName)},</p>
          <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6">
            You (or someone using this email) asked to change the email on your Moval.Living account to <strong>${escapeHtml(input.toEmail)}</strong>.
          </p>
          <p style="margin:0 0 28px;color:#374151;font-size:16px;line-height:1.6">
            Click the button below within the next hour to confirm:
          </p>
          <p style="margin:0 0 28px;text-align:center">
            <a href="${escapeHtml(input.confirmationUrl)}" style="display:inline-block;background:#007a7f;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 32px;border-radius:8px;font-size:16px">Confirm new email</a>
          </p>
          <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.5">
            Or paste this link into your browser:
          </p>
          <p style="margin:0 0 28px;color:#007a7f;font-size:12px;line-height:1.5;word-break:break-all">
            ${escapeHtml(input.confirmationUrl)}
          </p>
          <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6">
            <strong>Didn't request this?</strong> You can safely ignore this email. Nothing will change.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 40px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5">
            Moval.Living — Moreno Valley's Community Business Directory
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
    await transporter.sendMail({
      from,
      to: input.toEmail,
      subject,
      text,
      html,
    })
    return true
  } catch (e) {
    console.error('[EmailChange] SES confirmation email failed:', e)
    return false
  }
}