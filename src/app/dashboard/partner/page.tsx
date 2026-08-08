import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  Inbox,
  Mail,
  Phone,
  CheckCircle,
  Circle,
  Sparkles,
  ExternalLink,
  Calendar,
  Users,
  TrendingUp,
} from 'lucide-react'

/**
 * /dashboard/partner — partner self-serve view.
 *
 * Owner-only. Shows:
 *   - Quick stats (total leads, this month, contact rate)
 *   - Lead inbox with mark-as-contacted + notes
 *   - Partner page preview (deep-link to /partners/[slug])
 *   - Quick links (embed badge, edit LiveQA URL, etc.)
 *
 * Notes: kept as a server component for fast first paint; the small
 * "mark contacted" + "add note" interactions live in a sibling client
 * component (PartnerLeadRow.tsx) that's wired up via a tiny API route.
 */

interface PartnerDashboardProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function PartnerDashboardPage({ searchParams }: PartnerDashboardProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard/partner')

  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          tier: true,
          isExpertPartner: true,
          foundingPartnerSince: true,
          expertPartnerSlug: true,
          liveQaZoomUrl: true,
          liveQaNextDate: true,
          tagline: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  })

  const business = owner?.business
  if (!business) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <div className="container-max py-12 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No business linked</h1>
          <p className="text-slate-600 mb-6">
            Your account isn&apos;t linked to a business listing yet.
          </p>
          <Link href="/claim" className="btn-primary inline-flex items-center gap-2">
            Claim Your Business
          </Link>
        </div>
      </div>
    )
  }

  if (!business.isExpertPartner) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <div className="container-max py-12 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Upgrade to Expert Partner</h1>
            <p className="text-slate-600 mb-6">
              The partner dashboard is available to Expert Partner tier members.
              You&apos;ll see your leads, contact rates, and monthly performance recap here.
            </p>
            <Link href="/pricing" className="btn-primary inline-flex items-center gap-2">
              See Expert Partner Pricing →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { filter } = await searchParams
  const showContactedOnly = filter === 'contacted'
  const showUncontactedOnly = filter === 'new'

  // Lead query — 90-day window for the inbox; full count for stats
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [leads, totalCount, monthCount, contactedCount] = await Promise.all([
    prisma.expertPartnerLead.findMany({
      where: {
        businessId: business.id,
        ...(showContactedOnly ? { contacted: true } : {}),
        ...(showUncontactedOnly ? { contacted: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        message: true,
        contacted: true,
        contactedAt: true,
        notes: true,
        createdAt: true,
        ghlSyncedAt: true,
      },
    }),
    prisma.expertPartnerLead.count({ where: { businessId: business.id } }),
    prisma.expertPartnerLead.count({
      where: { businessId: business.id, createdAt: { gte: monthStart } },
    }),
    prisma.expertPartnerLead.count({
      where: { businessId: business.id, contacted: true, createdAt: { gte: ninetyDaysAgo } },
    }),
  ])

  const newCount = totalCount - contactedCount
  const contactRate = totalCount > 0 ? Math.round((contactedCount / totalCount) * 100) : 0

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="container-max py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">Partner Dashboard</h1>
              {business.foundingPartnerSince && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  ★ Founding Partner
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600">
              {business.name} · {business.category?.name}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/partners/${business.expertPartnerSlug || business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline inline-flex items-center gap-2 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              View Partner Page
            </a>
          </div>
        </div>
      </div>

      <div className="container-max py-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total leads" value={totalCount} icon={Inbox} color="text-blue-600 bg-blue-50" />
          <StatCard label="This month" value={monthCount} icon={TrendingUp} color="text-emerald-600 bg-emerald-50" />
          <StatCard label="Uncontacted" value={newCount} icon={Circle} color="text-amber-600 bg-amber-50" />
          <StatCard label="Contact rate (90d)" value={`${contactRate}%`} icon={CheckCircle} color="text-purple-600 bg-purple-50" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Lead inbox (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Lead inbox</h2>
              <div className="flex gap-1 text-xs">
                <FilterPill label="All" href="/dashboard/partner" active={!showContactedOnly && !showUncontactedOnly} />
                <FilterPill label="New" href="/dashboard/partner?filter=new" active={showUncontactedOnly} />
                <FilterPill label="Contacted" href="/dashboard/partner?filter=contacted" active={showContactedOnly} />
              </div>
            </div>

            {leads.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">
                  {showUncontactedOnly
                    ? "You're all caught up — no uncontacted leads."
                    : showContactedOnly
                      ? 'No contacted leads yet.'
                      : "When visitors fill out the form on your partner page, they'll show up here."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {leads.map((lead) => (
                  <PartnerLeadRow key={lead.id} lead={lead} />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="space-y-4">
            {/* Partner page preview card */}
            <section className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Your Partner Page</h3>
              <p className="text-xs text-slate-600 mb-3">
                Anyone can view this. New leads come from the form on this page.
              </p>
              <a
                href={`/partners/${business.expertPartnerSlug || business.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 group-hover:text-emerald-700 truncate">
                      {business.name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      /partners/{business.expertPartnerSlug || business.slug}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                </div>
              </a>
            </section>

            {/* Next Live Q&A */}
            {business.liveQaNextDate && (
              <section className="bg-gradient-to-br from-[#007a7f]/5 to-[#00405c]/5 border border-[#007a7f]/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-[#007a7f]" />
                  <h3 className="text-sm font-bold text-slate-900">Next Live Q&amp;A</h3>
                </div>
                <p className="text-sm text-slate-700">
                  {new Date(business.liveQaNextDate).toLocaleString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </section>
            )}

            {/* Help card */}
            <section className="bg-slate-100 rounded-xl p-5 text-xs text-slate-700">
              <h3 className="font-bold text-slate-900 mb-2">Tips</h3>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>Mark leads as contacted within 24 hours for best results</li>
                <li>Add private notes — they&apos;re only visible to you</li>
                <li>Embed your badge on your website for SEO + cross-traffic</li>
                <li>Schedule a Live Q&amp;A monthly to drive repeat visits</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  )
}

function FilterPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
        active
          ? 'bg-[#007a7f] text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </Link>
  )
}

// Imported separately to keep this file readable
import { PartnerLeadRow } from '@/components/partner/PartnerLeadRow'