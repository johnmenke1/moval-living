import Link from 'next/link'
import { Building2, Globe, ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { BusinessCard } from '@/components/business/BusinessCard'

// Shared server component behind /chamber and /hispanic-chamber — a live,
// always-current member directory that gives each chamber something concrete
// to link to and co-brand. Members automatically appear here when their
// listing carries the chamber flag; no separate list to maintain.

const VARIANTS = {
  chamber: {
    name: 'Moreno Valley Chamber of Commerce',
    shortName: 'MV Chamber',
    icon: Building2,
    where: { chamberMember: true },
    blurb:
      'moval.living proudly partners with the Moreno Valley Chamber of Commerce. Every chamber member below has a live listing on the directory — supporting them supports the whole community.',
  },
  hispanic: {
    name: 'Moreno Valley Hispanic Chamber of Commerce',
    shortName: 'MV Hispanic Chamber',
    icon: Globe,
    where: { hispanicChamberMember: true },
    blurb:
      'moval.living proudly partners with the Moreno Valley Hispanic Chamber of Commerce. Every member below has a live listing on the directory — muchos atienden en español.',
  },
} as const

export async function ChamberDirectory({ variant }: { variant: keyof typeof VARIANTS }) {
  const config = VARIANTS[variant]
  const Icon = config.icon

  const members = await prisma.business.findMany({
    where: { status: 'APPROVED', ...config.where },
    include: {
      category: true,
      reviews: true,
      _count: { select: { reviews: true } },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Co-branded header band */}
      <section className="bg-gradient-to-br from-secondary to-primary">
        <div className="container-max py-14 md:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-sm px-4 py-1.5 rounded-full mb-5">
              <Icon className="w-4 h-4" />
              Community Partner
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">{config.name}</h1>
            <p className="text-white/80 text-lg leading-relaxed">{config.blurb}</p>
          </div>
        </div>
      </section>

      <div className="container-max py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text">Member Directory</h2>
            <p className="text-text-secondary text-sm mt-0.5">
              {members.length} {config.shortName} member{members.length !== 1 ? 's' : ''} on moval.living
            </p>
          </div>
          <Link
            href="/search"
            className="hidden sm:flex items-center gap-1 text-primary font-medium hover:gap-2 transition-all"
          >
            Browse all businesses <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {members.length === 0 ? (
          <p className="text-center text-text-secondary py-16">
            Member listings are on their way — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map(b => (
              <BusinessCard
                key={b.id}
                business={{
                  ...b,
                  isBestOf: b.isBestOfWinner,
                  coupon: b.coupon as {
                    headline: string
                    description?: string | null
                    code?: string | null
                    expiresAt?: string | null
                  } | null,
                }}
              />
            ))}
          </div>
        )}

        {/* Member CTA */}
        <div className="mt-12 rounded-2xl bg-white border border-slate-200 p-8 text-center">
          <h3 className="text-xl font-bold text-text mb-2">A {config.shortName} member but not listed here?</h3>
          <p className="text-text-secondary mb-5 max-w-xl mx-auto">
            Claim your free listing and your chamber membership will show on your profile.
          </p>
          <Link href="/claim" className="btn-primary">
            Claim your listing
          </Link>
        </div>
      </div>
    </div>
  )
}
