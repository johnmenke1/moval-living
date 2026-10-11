import Link from 'next/link'
import type { Metadata } from 'next'
import { HALLOWEEN_CONFIG, getContestState } from '@/lib/halloween'
import { EnterForm } from '@/components/halloween/EnterForm'

export const metadata: Metadata = {
  title: 'Enter Your Home - MoVal Haunted Homes',
  description: 'Enter your decorated home in Moreno Valley\'s Halloween home decorating contest hosted by American Legion Post 574.',
  alternates: { canonical: 'https://www.moval.living/halloween/enter' },
}

export const dynamic = 'force-dynamic'

export default function EnterPage() {
  const state = getContestState()
  const c = HALLOWEEN_CONFIG
  const close = new Date(c.submissionsClose).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' })
  return (
    <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 max-w-3xl">
      <Link href="/halloween" className="text-sm text-purple-300 hover:text-orange-300">← Back to the map</Link>
      <h1 className="font-halloween text-5xl text-orange-400 mt-3">Enter your haunted home</h1>
      <p className="mt-2 text-purple-100/90">
        Show off your Halloween decorations to all of Moreno Valley. Entries close {close}. Volunteers from {c.host} review
        every entry before it appears on the map.
      </p>
      {state.submissionsOpen ? (
        <EnterForm categories={c.categories} maxPhotos={c.maxPhotos} />
      ) : (
        <div className="mt-8 rounded-2xl border border-[#3a1d57] bg-[#160b24] p-6 text-purple-100">
          {state.phase === 'upcoming' ? 'Entries have not opened yet - check back soon!' : 'Entries are closed for this year. Thanks to everyone who took part!'}
        </div>
      )}
    </main>
  )
}
