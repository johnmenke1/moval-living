/**
 * Email sending via AWS SES SMTP.
 * Reusable across magic links, forgot-password, etc.
 */

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  const nodemailer = await import('nodemailer')

  const transporter = nodemailer.createTransport({
    host: process.env.AWS_SES_SMTP_HOST,
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.AWS_SES_SMTP_USERNAME,
      pass: process.env.AWS_SES_SMTP_PASSWORD,
    },
  })

  await transporter.sendMail({
    from: process.env.AUTH_EMAIL_FROM || 'MovalLiving <noreply@moval.living>',
    to,
    subject,
    html,
    text,
  })
}

export async function sendForgotPasswordEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
          <!-- Header -->
          <tr>
            <td style="background:#1a56db;padding:32px 40px;text-align:center">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700">Moval<span style="color:#93c5fd">.living</span></h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600">Reset Your Password</h2>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6">
                We received a request to reset the password for your Moval.living owner account.
                Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
              </p>
              <p style="margin:0 0 32px;text-align:center">
                <a href="${resetUrl}" style="display:inline-block;background:#1a56db;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px">
                  Reset Password
                </a>
              </p>
              <p style="margin:0 0 16px;color:#4b5563;font-size:13px;line-height:1.6">
                If you didn't request a password reset, you can safely ignore this email.
                Your password won't be changed unless you click the button above.
              </p>
              <p style="margin:32px 0 0;color:#9ca3af;font-size:12px;line-height:1.6">
                If the button doesn't work, copy and paste this URL into your browser:<br/>
                <a href="${resetUrl}" style="color:#1a56db;word-break:break-all">${resetUrl}</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center">
          MovalLiving · Moreno Valley's Business Directory
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const text = `Reset Your Password

We received a request to reset the password for your Moval.living owner account.

Click the link below to set a new password. This link expires in 1 hour:

${resetUrl}

If you didn't request a password reset, you can safely ignore this email.

— MovalLiving`
  await sendEmail({ to, subject: 'Reset Your Moval.living Password', html, text })
}
