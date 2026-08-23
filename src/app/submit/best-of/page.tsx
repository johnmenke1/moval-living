import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import SubmitBestOfForm from './SubmitBestOfForm'
import { SubmitBestOfHero } from '@/components/best-of/SubmitBestOfHero'
import { SubmitBestOfSidebar } from '@/components/best-of/SubmitBestOfSidebar'

export const metadata: Metadata = {
  title: 'Nominate a Business for Best Of Moreno Valley',
  description:
    "Know a local business that's killing it? Nominate them for moval.living's Best Of awards. We'll review every nomination personally.",
  alternates: { canonical: 'https://www.moval.living/submit/best-of' },
  openGraph: {
    type: 'website',
    url: 'https://www.moval.living/submit/best-of',
    title: 'Nominate a Business for Best Of Moreno Valley',
    description:
      "Know a local business that's killing it? Nominate them for moval.living's Best Of awards.",
  },
  twitter: {
    card: 'summary',
    title: 'Nominate a Business for Best Of Moreno Valley',
    description: "Tell us about a local business doing great work in MoVal.",
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getWinnerCount() {
  return prisma.bestOfNominee.count({ where: { winner: true } })
}

export default async function SubmitBestOfPage() {
  const winnerCount = await getWinnerCount()

  return (
    <div className="bg-slate-50 min-h-screen">
      <SubmitBestOfHero winnerCount={winnerCount} />

      <section className="container-max py-10 md:py-14">
        <div className="grid lg:grid-cols-[1fr_22rem] gap-8 lg:gap-12 items-start">
          <SubmitBestOfForm />
          <div className="hidden lg:block">
            <SubmitBestOfSidebar />
          </div>
        </div>

        {/* Mobile-only sidebar stacked below form */}
        <div className="lg:hidden mt-8">
          <SubmitBestOfSidebar />
        </div>
      </section>
    </div>
  )
}
