import type { Metadata } from 'next'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import SubmitBestOfForm from './SubmitBestOfForm'

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
  // No "noindex" — public submission pages are real destination pages for
  // SEO long-tail ("nominate a business Moreno Valley" etc).
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function SubmitBestOfPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-secondary text-white">
        <div className="container-max py-12">
          <div className="flex items-center gap-3 mb-3">
            <Trophy className="w-7 h-7 text-white/80" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              Community Nominations
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 max-w-2xl">
            Nominate a Business for Best Of Moreno Valley
          </h1>
          <p className="text-white/85 text-base sm:text-lg max-w-2xl leading-relaxed">
            Know a local business that&apos;s killing it? Tell us about it. We read every nomination
            personally — and if it makes the list, you&apos;ll see it on{' '}
            <Link href="/best-of" className="underline underline-offset-4 hover:text-white">
              moval.living/best-of
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="container-max py-10">
        <div className="mx-auto max-w-2xl">
          <SubmitBestOfForm />
        </div>
      </section>
    </div>
  )
}