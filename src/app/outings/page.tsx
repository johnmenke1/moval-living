import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { MagazineWeatherStamp } from '@/components/outings/MagazineWeatherStamp'
import { MagazineReveal } from '@/components/outings/MagazineReveal'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Live Curiously — A Field Journal of Weekend Escapes from Moreno Valley',
  description:
    'Photo essays from John & Karina Menke — train day trips, coastal drives, and Inlands detours. A Sunday-morning almanac of where to point the car or catch the next Metrolink out of Moreno Valley.',
}

/**
 * Magazine-style index for OUTING posts.
 *
 * Layout (top to bottom):
 *   1. Masthead           — full-bleed dark navy band with title + weather stamp
 *   2. Cover Story        — latest post, full-width, image-left / text-right
 *   3. The Spread         — two staggered cards (unequal heights, offset)
 *   4. Field Note         — a single quiet row with a pull quote
 *   5. Rear Index         — dense list of remaining trips, Fraunces caps
 *   6. Signature          — "Karina and John in MV"
 */
export default async function OutingsIndexPage() {
  const posts = await prisma.guestPost.findMany({
    where: { status: 'published', postType: 'OUTING' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
  })

  const now = new Date().toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const [cover, ...rest] = posts
  const spread = rest.slice(0, 2)
  const fieldNote = rest[2]
  const rearIndex = rest.slice(3)

  return (
    <div className="bg-background">
      {/* ── 1. Masthead ─────────────────────────────────────────────── */}
      <section className="relative bg-[#00405c] text-white overflow-hidden">
        {/* Subtle topographic noise — hand-drawn map feel without an image */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative container-max pt-6 sm:pt-8 pb-20 sm:pb-28 lg:pb-32">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent/90">
                Issue 001 · Late Summer 2026
              </p>
              <h1 className="mt-3 font-heading text-6xl sm:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tight">
                Live Curiously
              </h1>
              <p className="mt-4 max-w-2xl font-heading text-lg sm:text-xl italic text-white/85 leading-snug">
                A field journal of weekend escapes from Moreno Valley —
                where the train stops, where the road bends, and what we find
                when we go.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/70">
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inset-0 inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  New this week
                </span>
                <span className="text-white/30">·</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/70">
                  {posts.length} {posts.length === 1 ? 'essay' : 'essays'} from the road
                </span>
              </div>
            </div>
            <MagazineWeatherStamp initialNow={now} />
          </div>
        </div>
        {/* Bottom rule — magazine cover spine */}
        <div className="relative h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      </section>

      {/* ── 2. Cover Story ─────────────────────────────────────────── */}
      {cover && (
        <section className="container-max pt-12 sm:pt-16">
          <MagazineReveal>
            <div className="flex items-center gap-3 mb-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent">
                The Cover Story
              </span>
              <span className="h-px flex-1 bg-text/15" />
              {cover.publishedAt && (
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-secondary">
                  {new Date(cover.publishedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>

            <Link
              href={`/outings/${cover.slug}`}
              className="group grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch"
            >
              {/* Cover image — with corner tab signature */}
              <div className="lg:col-span-7 relative">
                <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-slate-100 -rotate-[0.6deg] shadow-2xl shadow-secondary/20">
                  {cover.heroImageUrl && (
                    <Image
                      src={cover.heroImageUrl}
                      alt={cover.title}
                      fill
                      priority
                      sizes="(min-width: 1024px) 58vw, 100vw"
                      className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.03]"
                    />
                  )}
                  {/* Corner tab signature */}
                  <div className="absolute top-0 left-0 bg-accent text-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.24em] font-semibold">
                    Issue 001 — Cover
                  </div>
                </div>
              </div>

              {/* Cover text */}
              <div className="lg:col-span-5 flex flex-col justify-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary mb-3">
                  Feature · {cover.heroImageUrl ? 'Photo essay' : 'Essay'}
                </p>
                <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.05] tracking-tight text-text group-hover:text-primary transition-colors">
                  {cover.title}
                </h2>
                <p className="mt-5 font-heading text-lg italic leading-relaxed text-text-secondary">
                  {cover.excerpt}
                </p>
                <div className="mt-6 flex items-center gap-3 text-sm">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white font-bold">
                    JM
                  </span>
                  <div>
                    <div className="font-semibold text-text">John &amp; Karina Menke</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">
                      From Moreno Valley
                    </div>
                  </div>
                </div>
                <span className="mt-7 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-primary border-b-2 border-accent pb-1 self-start">
                  Read the essay
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </div>
            </Link>
          </MagazineReveal>
        </section>
      )}

      {/* ── 3. The Spread ───────────────────────────────────────────── */}
      {spread.length > 0 && (
        <section className="container-max pt-20 sm:pt-24">
          <MagazineReveal>
            <div className="flex items-center gap-3 mb-8">
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent">
                The Spread
              </span>
              <span className="h-px flex-1 bg-text/15" />
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-secondary">
                Two more this issue
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10">
              {/* Left spread — taller, pulled up slightly */}
              {spread[0] && (
                <Link
                  href={`/outings/${spread[0].slug}`}
                  className="group md:col-span-5 md:-mt-2 flex flex-col"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-100 shadow-xl shadow-secondary/15 transition-transform duration-700 group-hover:-translate-y-1">
                    {spread[0].heroImageUrl && (
                      <Image
                        src={spread[0].heroImageUrl}
                        alt={spread[0].title}
                        fill
                        sizes="(min-width: 768px) 42vw, 100vw"
                        className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                      />
                    )}
                    <div className="absolute top-0 left-0 bg-secondary text-white px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.24em]">
                      Feature 02
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent/90 mb-1">
                        {spread[0].publishedAt
                          ? new Date(spread[0].publishedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Recent'}
                      </p>
                    </div>
                  </div>
                  <h3 className="mt-5 font-heading text-2xl sm:text-3xl font-bold leading-snug text-text group-hover:text-primary transition-colors">
                    {spread[0].title}
                  </h3>
                  <p className="mt-3 font-heading text-base italic text-text-secondary line-clamp-3">
                    {spread[0].excerpt}
                  </p>
                </Link>
              )}

              {/* Right spread — wider, offset down for the montage feel */}
              {spread[1] && (
                <Link
                  href={`/outings/${spread[1].slug}`}
                  className="group md:col-span-7 md:mt-12 flex flex-col"
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-slate-100 shadow-xl shadow-secondary/15 transition-transform duration-700 group-hover:-translate-y-1">
                    {spread[1].heroImageUrl && (
                      <Image
                        src={spread[1].heroImageUrl}
                        alt={spread[1].title}
                        fill
                        sizes="(min-width: 768px) 58vw, 100vw"
                        className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                      />
                    )}
                    <div className="absolute top-0 left-0 bg-secondary text-white px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.24em]">
                      Feature 03
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent/90 mb-1">
                        {spread[1].publishedAt
                          ? new Date(spread[1].publishedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Recent'}
                      </p>
                    </div>
                  </div>
                  <h3 className="mt-5 font-heading text-2xl sm:text-3xl font-bold leading-snug text-text group-hover:text-primary transition-colors">
                    {spread[1].title}
                  </h3>
                  <p className="mt-3 font-heading text-base italic text-text-secondary line-clamp-3">
                    {spread[1].excerpt}
                  </p>
                </Link>
              )}
            </div>
          </MagazineReveal>
        </section>
      )}

      {/* ── 4. Field Note ──────────────────────────────────────────── */}
      {fieldNote && (
        <section className="container-max pt-20 sm:pt-24">
          <MagazineReveal>
            <div className="flex items-center gap-3 mb-8">
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent">
                Field Note
              </span>
              <span className="h-px flex-1 bg-text/15" />
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-secondary">
                One quiet line from the road
              </span>
            </div>

            <Link
              href={`/outings/${fieldNote.slug}`}
              className="group grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 items-center bg-secondary text-white rounded-2xl p-8 sm:p-10 lg:p-12 overflow-hidden relative"
            >
              {/* Decorative quote glyph */}
              <div
                className="absolute -top-6 -right-2 font-heading text-[14rem] leading-none text-accent/15 select-none pointer-events-none"
                aria-hidden="true"
              >
                &ldquo;
              </div>

              <div className="md:col-span-5 relative">
                <div className="relative aspect-[4/5] overflow-hidden rounded-lg shadow-2xl shadow-black/30">
                  {fieldNote.heroImageUrl && (
                    <Image
                      src={fieldNote.heroImageUrl}
                      alt={fieldNote.title}
                      fill
                      sizes="(min-width: 768px) 42vw, 100vw"
                      className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                    />
                  )}
                </div>
              </div>

              <div className="md:col-span-7 relative">
                <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent mb-3">
                  {fieldNote.publishedAt
                    ? new Date(fieldNote.publishedAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recent'}
                </p>
                <h3 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-tight">
                  {fieldNote.title}
                </h3>
                <blockquote className="mt-6 font-heading text-xl sm:text-2xl italic leading-relaxed text-white/90 border-l-2 border-accent pl-5">
                  {fieldNote.excerpt}
                </blockquote>
                <span className="mt-7 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-accent border-b-2 border-accent/60 pb-1">
                  Read the field note
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </div>
            </Link>
          </MagazineReveal>
        </section>
      )}

      {/* ── 5. Rear Index ──────────────────────────────────────────── */}
      {rearIndex.length > 0 && (
        <section className="container-max pt-20 sm:pt-24 pb-16">
          <MagazineReveal>
            <div className="flex items-center gap-3 mb-8">
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent">
                The Rear Index
              </span>
              <span className="h-px flex-1 bg-text/15" />
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-secondary">
                Earlier issues
              </span>
            </div>

            <ul className="divide-y divide-text/10 border-t border-b border-text/10">
              {rearIndex.map((post, i) => (
                <li key={post.id}>
                  <Link
                    href={`/outings/${post.slug}`}
                    className="group grid grid-cols-12 gap-4 items-baseline py-5 hover:bg-text/[0.02] -mx-2 px-2 rounded-sm transition-colors"
                  >
                    <span className="col-span-1 font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary group-hover:text-accent">
                      {String(i + 4).padStart(2, '0')}
                    </span>
                    <span className="col-span-7 sm:col-span-8 font-heading text-lg sm:text-xl font-semibold text-text group-hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </span>
                    <span className="hidden sm:block col-span-2 font-heading text-sm italic text-text-secondary line-clamp-1">
                      {post.excerpt}
                    </span>
                    <span className="col-span-4 sm:col-span-1 font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary text-right">
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </MagazineReveal>
        </section>
      )}

      {/* Empty state — same magazine voice */}
      {posts.length === 0 && (
        <section className="container-max py-24 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent mb-3">
            Issue 001
          </p>
          <p className="font-heading text-3xl italic text-text-secondary">
            No essays yet from the road.
          </p>
          <p className="mt-3 text-text-secondary">
            The first dispatch is coming soon.
          </p>
        </section>
      )}

      {/* ── 6. Signature ───────────────────────────────────────────── */}
      <section className="container-max pb-16">
        <div className="border-t border-accent/40 pt-8 flex items-center justify-between gap-6 flex-wrap">
          <p className="font-heading text-base italic text-text-secondary">
            <span className="text-text">Live Curiously</span> is a Sunday-morning
            project — Karina &amp; John, from Moreno Valley.
          </p>
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-accent">
            On the road since 2026
          </span>
        </div>
      </section>
    </div>
  )
}
