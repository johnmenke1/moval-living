import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Camera, Vote, Sparkles, CalendarDays, Store, Star, Tag } from 'lucide-react'
import { HALLOWEEN_CONFIG, getContestState } from '@/lib/halloween'
import { getPublicEntries } from '@/lib/halloween-queries'
import { HauntedExplorer } from '@/components/halloween/HauntedExplorer'
import { Countdown } from '@/components/halloween/Countdown'

export const dynamic = 'force-dynamic'

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' })

export default async function HalloweenPage() {
  const state = getContestState()
  let entries: Awaited<ReturnType<typeof getPublicEntries>> = []
  try {
    entries = await getPublicEntries()
  } catch (err) {
    // Tables not migrated yet (or DB hiccup) - render an empty contest rather than a 500.
    console.error('[halloween] could not load entries', err)
  }
  const c = HALLOWEEN_CONFIG

  const countdown =
    state.phase === 'upcoming'
      ? { target: c.submissionsOpen, label: 'Entries open in' }
      : state.phase === 'open'
        ? { target: c.votingOpen, label: 'Voting opens in' }
        : state.phase === 'voting'
          ? { target: c.votingClose, label: 'Voting closes in' }
          : null

  return (
    <main>
      {/* Hero */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-8 text-center md:text-left">
        <div className="mt-4 grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <h1 className="font-halloween text-5xl sm:text-6xl md:text-7xl leading-[0.95] text-orange-400 drop-shadow-[0_0_24px_rgba(255,122,26,0.45)]">
              {c.title}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-purple-100/90">
              Moreno Valley&apos;s Halloween home decorating contest. Explore the spookiest houses in town on the map,
              then vote for your favorite.
            </p>
            <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-3">
              {state.submissionsOpen && (
                <Link href="/halloween/enter" className="rounded-xl bg-orange-500 hover:bg-orange-400 text-[#1b0b2e] font-bold px-6 py-3 transition">
                  🏚️ Enter your home
                </Link>
              )}
              <a href="#map" className="rounded-xl border border-[#5a2d85] hover:bg-[#2a1546] px-6 py-3 font-semibold transition">
                Explore the map
              </a>
            </div>
          </div>
          <div className="flex flex-col items-center md:items-end gap-5">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#3a1d57] bg-[#160b24] p-5 shadow-[0_0_36px_rgba(201,162,39,0.18)]">
              <Image
                src="/halloween/american-legion-post-574.png"
                alt="American Legion Post 574"
                width={288}
                height={288}
                className="w-48 h-48 md:w-64 md:h-64"
                priority
              />
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#c9a227]/80">Presented by</p>
              <p className="font-halloween text-2xl text-[#e6c453] leading-none">American Legion</p>
              <a
                href="https://www.facebook.com/profile.php?id=61595164925011"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-200/70 hover:text-[#e6c453] underline underline-offset-2"
              >
                Follow on Facebook
              </a>
            </div>
            {countdown && <Countdown {...countdown} />}
          </div>
        </div>
      </section>

      {/* Map + voting */}
      <section id="map" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 scroll-mt-24">
        <HauntedExplorer
          initialEntries={entries}
          initialState={state}
          categories={c.categories}
          votingOpensLabel={fmt(c.votingOpen)}
        />
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="font-halloween text-4xl text-orange-400 mb-6">How it works</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: Camera, t: '1. Enter', d: `Submit your home and photos between ${fmt(c.submissionsOpen)} and ${fmt(c.submissionsClose)}.` },
            { icon: Sparkles, t: '2. Approval', d: 'Post 574 volunteers review each entry and add approved homes to the map.' },
            { icon: Vote, t: '3. Vote', d: `Public voting runs ${fmt(c.votingOpen)} - ${fmt(c.votingClose)}. One vote per home, per person.` },
            { icon: MapPin, t: '4. Trick-or-treat tour', d: 'Use the map to plan a route and see the displays in person.' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-[#3a1d57] bg-[#160b24] p-5">
              <Icon className="w-6 h-6 text-orange-400 mb-3" />
              <h3 className="font-semibold text-white">{t}</h3>
              <p className="mt-1 text-sm text-purple-200/80">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-purple-300/60">
          Winners announced {fmt(c.winnersAnnounced)}. Private details (your name, email, phone and exact address unless you opt in)
          are never shown publicly.
        </p>
      </section>

      {/* Prizes + participation perk */}
      {(c.prizes.length > 0 || c.sponsors.length > 0) && (
        <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid gap-4 md:grid-cols-2">
            {c.prizes.length > 0 && (
              <div className="rounded-2xl border border-[#3a1d57] bg-[#160b24] p-6">
                <h2 className="font-halloween text-3xl text-orange-400 mb-3">Prizes</h2>
                <ul className="space-y-2 text-sm">
                  {c.prizes.map((p) => (
                    <li key={p.place} className="flex gap-2"><span className="font-semibold text-white">{p.place}:</span><span className="text-purple-200/80">{p.prize}</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-2xl border border-[#3a1d57] bg-[#160b24] p-6">
              <h2 className="font-halloween text-3xl text-orange-400 mb-3">Just for entering</h2>
              <p className="text-sm text-purple-200/80">
                The first {c.participationSignLimit} homes to register receive a free competition
                participation sign for their yard. Submit your entry early to claim yours.
              </p>
            </div>
          </div>
          {c.sponsors.length > 0 && (
            <div className="mt-4 rounded-2xl border border-[#3a1d57] bg-[#160b24] p-6">
              <h2 className="font-halloween text-3xl text-orange-400 mb-3">Sponsors</h2>
              <ul className="flex flex-wrap gap-2">
                {c.sponsors.map((s) => (
                  <li key={s.name}>
                    {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer sponsored" className="rounded-full bg-[#2a1546] px-3 py-1 text-sm hover:bg-[#3a1d5e]">{s.name}</a>
                      : <span className="rounded-full bg-[#2a1546] px-3 py-1 text-sm">{s.name}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Cross-promo */}
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-3xl border border-[#3a1d57] bg-gradient-to-br from-[#1f0f33] to-[#120920] p-8">
          <h2 className="font-halloween text-3xl text-orange-400">More to do in Moreno Valley</h2>
          <p className="mt-1 text-purple-200/80 text-sm max-w-2xl">
            MoVal Living is the local guide to Moreno Valley businesses, events and community. While you&apos;re out on the haunted tour:
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: '/events', icon: CalendarDays, t: 'Fall events', d: 'Festivals, fundraisers and family fun' },
              { href: '/search', icon: Store, t: 'Local businesses', d: 'Restaurants, shops and services' },
              { href: '/best-of', icon: Star, t: 'Best of Moreno Valley', d: 'Vote for your local favorites' },
              { href: '/deals', icon: Tag, t: 'Local deals', d: 'Save at neighborhood businesses' },
            ].map(({ href, icon: Icon, t, d }) => (
              <Link key={href} href={href} className="rounded-2xl border border-[#3a1d57] bg-[#160b24] p-4 hover:border-orange-400 transition">
                <Icon className="w-5 h-5 text-orange-400 mb-2" />
                <div className="font-semibold text-white text-sm">{t}</div>
                <div className="text-xs text-purple-200/70">{d}</div>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-xs text-purple-300/60">
            Follow <a className="underline" href="https://www.facebook.com/profile.php?id=61595164925011" target="_blank" rel="noopener noreferrer">American Legion Post 574 on Facebook</a> for contest updates.
            Local business? <Link className="underline" href="/submit">Get listed on MoVal Living</Link>.
          </p>
        </div>
      </section>
    </main>
  )
}
