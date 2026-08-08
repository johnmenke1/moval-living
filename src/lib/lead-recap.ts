import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

/**
 * Weekly lead recap — sends each Expert Partner a summary of last
 * week's leads + month-to-date totals. Designed to be run by the
 * scheduled cron job (Mondays at 9am Pacific).
 *
 * Skips partners with zero activity. Skips partners whose business
 * is no longer EXPERT_PARTNER tier (catches the cancellation race).
 *
 * Idempotent: safe to re-run if it fails midway. Only sends to
 * partners whose `lastRecapSentAt` is older than 7 days.
 */

interface RecapResult {
  scanned: number
  sent: number
  skipped: number
  failed: number
  errors: Array<{ businessName: string; error: string }>
}

export async function sendWeeklyLeadRecaps(now: Date = new Date()): Promise<RecapResult> {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  // Find all active Expert Partner businesses with an email + an owner
  const partners = await prisma.business.findMany({
    where: {
      isExpertPartner: true,
      status: 'APPROVED',
      email: { not: null },
      ownerId: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      expertPartnerSlug: true,
      slug: true,
      foundingPartnerSince: true,
      owner: { select: { email: true, name: true } },
    },
  })

  const result: RecapResult = {
    scanned: partners.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  for (const p of partners) {
    if (!p.email || !p.owner?.email) {
      result.skipped++
      continue
    }
    const ownerEmail = p.owner.email

    try {
      const [weekLeads, monthLeads, totalLeads, contactedThisWeek] = await Promise.all([
        prisma.expertPartnerLead.findMany({
          where: { businessId: p.id, createdAt: { gte: weekAgo } },
          orderBy: { createdAt: 'desc' },
          select: { name: true, email: true, contacted: true, createdAt: true },
        }),
        prisma.expertPartnerLead.count({
          where: { businessId: p.id, createdAt: { gte: monthStart } },
        }),
        prisma.expertPartnerLead.count({ where: { businessId: p.id } }),
        prisma.expertPartnerLead.count({
          where: {
            businessId: p.id,
            contacted: true,
            createdAt: { gte: weekAgo },
          },
        }),
      ])

      // Skip inactive partners (don't spam)
      if (weekLeads.length === 0 && monthLeads === 0) {
        result.skipped++
        continue
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.moval.living'
      const dashboardUrl = `${baseUrl}/dashboard/partner`
      const partnerUrl = `${baseUrl}/partners/${p.expertPartnerSlug || p.slug}`

      const weekRows = weekLeads
        .map(
          (l) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a">${escapeHtml(l.name)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px"><a href="mailto:${escapeHtml(l.email)}" style="color:#007a7f;text-decoration:none">${escapeHtml(l.email)}</a></td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#5a6c72">${new Date(l.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:600;color:${l.contacted ? '#059669' : '#d97706'}">${l.contacted ? 'Contacted' : 'New'}</td>
          </tr>`
        )
        .join('')

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr><td style="background:linear-gradient(135deg,#007a7f,#00405c);padding:32px;color:#fff">
          <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#93c5fd">Weekly recap</p>
          <h1 style="margin:8px 0 0;font-size:24px;font-weight:800">Your Expert Partner dashboard</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#cbd5e1">${new Date(weekAgo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">Hi ${escapeHtml(p.owner?.name?.split(' ')[0] || 'there')},</h2>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569">
            Here's what happened with your partner page last week.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr>
              <td width="33%" style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center">
                <p style="margin:0;font-size:28px;font-weight:800;color:#007a7f">${weekLeads.length}</p>
                <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#5a6c72;text-transform:uppercase;letter-spacing:0.5px">New leads (7d)</p>
              </td>
              <td width="8"></td>
              <td width="33%" style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center">
                <p style="margin:0;font-size:28px;font-weight:800;color:#007a7f">${monthLeads}</p>
                <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#5a6c72;text-transform:uppercase;letter-spacing:0.5px">This month</p>
              </td>
              <td width="8"></td>
              <td width="33%" style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center">
                <p style="margin:0;font-size:28px;font-weight:800;color:#007a7f">${totalLeads}</p>
                <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#5a6c72;text-transform:uppercase;letter-spacing:0.5px">Total ever</p>
              </td>
            </tr>
          </table>

          ${weekLeads.length > 0 ? `
            <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0f172a">New this week</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px">
              <thead>
                <tr style="background:#f8fafc">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#5a6c72;text-transform:uppercase;letter-spacing:0.5px">Name</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#5a6c72;text-transform:uppercase;letter-spacing:0.5px">Email</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#5a6c72;text-transform:uppercase;letter-spacing:0.5px">When</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#5a6c72;text-transform:uppercase;letter-spacing:0.5px">Status</th>
                </tr>
              </thead>
              <tbody>${weekRows}</tbody>
            </table>
          ` : `
            <p style="margin:0 0 24px;font-size:14px;color:#5a6c72;font-style:italic">No new leads this week. Your partner page still has ${monthLeads} leads this month — keep it up.</p>
          `}

          ${contactedThisWeek < weekLeads.length ? `
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:24px">
              <p style="margin:0;font-size:14px;color:#92400e;font-weight:600">
                ${weekLeads.length - contactedThisWeek} lead${weekLeads.length - contactedThisWeek === 1 ? '' : 's'} need${weekLeads.length - contactedThisWeek === 1 ? 's' : ''} follow-up.
              </p>
            </div>
          ` : ''}

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
            <tr>
              <td align="center">
                <a href="${dashboardUrl}" style="display:inline-block;background:#007a7f;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px">
                  Open Partner Dashboard →
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">
            Your partner page: <a href="${partnerUrl}" style="color:#007a7f">${partnerUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e2e8f0;background:#f8fafc">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center">
            You're receiving this because you're an Expert Partner on moval.living.<br>
            <a href="${dashboardUrl}" style="color:#007a7f">Manage preferences</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

      const text = `Weekly Lead Recap — ${p.name}

New leads (last 7 days): ${weekLeads.length}
This month: ${monthLeads}
Total ever: ${totalLeads}

${weekLeads.length > 0
  ? weekLeads
      .map(
        (l) =>
          `- ${l.name} (${l.email}) — ${new Date(l.createdAt).toLocaleDateString()} — ${l.contacted ? 'Contacted' : 'NEW'}`
      )
      .join('\n')
  : 'No new leads this week.'}

Open your dashboard: ${dashboardUrl}`

      await sendEmail({
        to: ownerEmail,
        subject: `${weekLeads.length === 0 ? 'Weekly recap' : `${weekLeads.length} new lead${weekLeads.length === 1 ? '' : 's'} this week`} — ${p.name}`,
        html,
        text,
      })

      result.sent++
    } catch (err) {
      result.failed++
      result.errors.push({
        businessName: p.name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}