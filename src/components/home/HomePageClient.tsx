'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  ArrowRight,
  ChevronRight,
  UtensilsCrossed,
  HardHat,
  Stethoscope,
  ShoppingBag,
  Car,
  Briefcase,
  Sparkles,
  Wrench,
  GraduationCap,
  PawPrint,
  Landmark,
  Gauge,
  Building,
  ShieldCheck,
  Cannabis,
  Hotel,
  Handshake,
  Church,
  KeyRound,
  HelpingHand,
  Truck,
  Drama,
  Calendar as CalendarIcon,
  type LucideIcon,
} from 'lucide-react'
import { categories } from '@/data/categories'
import { BusinessCard } from '@/components/business/BusinessCard'
import { EventsCallout, type UpcomingEvent } from '@/components/home/EventsCallout'
import LiveActivityTicker from '@/components/home/LiveActivityTicker'
import { HeroVideo } from '@/components/home/HeroVideo'
import { ShimmerText } from '@/components/motion'
import { motion } from 'framer-motion'

// Constrained to four brand-adjacent hues (teal, navy, terracotta, warm
// gold) instead of 22 arbitrary rainbow colors — the grid reads as one
// designed system while icons still vary enough to scan.
const categoryColors: Record<string, string> = {
  restaurants: 'var(--color-terracotta)',
  contractors: 'var(--color-navy)',
  healthcare: 'var(--color-primary-dark)',
  retail: 'var(--color-brass)',
  'auto-repair': 'var(--color-navy)',
  'auto-dealers': 'var(--color-navy)',
  churches: 'var(--color-primary-dark)',
  'property-management': 'var(--color-navy)',
  'non-profits': 'var(--color-terracotta)',
  'supply-logistics': 'var(--color-navy)',
  entertainment: 'var(--color-brass)',
  professional: 'var(--color-navy)',
  beauty: 'var(--color-terracotta)',
  'home-services': 'var(--color-primary-dark)',
  education: 'var(--color-brass)',
  pets: 'var(--color-primary-dark)',
  finance: 'var(--color-navy)',
  'real-estate': 'var(--color-primary-dark)',
  insurance: 'var(--color-navy)',
  dispensaries: 'var(--color-primary-dark)',
  hospitality: 'var(--color-brass)',
  'service-clubs': 'var(--color-terracotta)',
}

const categoryIcons: Record<string, LucideIcon> = {
  UtensilsCrossed,
  HardHat,
  Stethoscope,
  ShoppingBag,
  Car,
  Briefcase,
  Sparkles,
  Wrench,
  GraduationCap,
  PawPrint,
  Landmark,
  Gauge,
  Building,
  ShieldCheck,
  Cannabis,
  Hotel,
  Handshake,
  Church,
  KeyRound,
  HelpingHand,
  Truck,
  Drama,
}

interface Business {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string
  address: string
  tier: string
  status: string
  logo: string | null
  coverImage: string | null
  photos: string[]
  category: { name: string; slug: string }
  reviews: Array<{ rating: number }>
  _count?: { reviews: number }
  // Deal — first-class Deal row. Replaces the legacy Business.coupon Json
  // blob. Optional because the home page selects businesses with a slim
  // projection that may not include deals; the BusinessCard handles
  // `deals === undefined` by showing the cover/logo/photo fallback chain.
  deals?: Array<{ imageUrl: string | null; isActive?: boolean }>
  isBestOf?: boolean
  isExpertPartner?: boolean
  foundingPartnerSince?: string | Date | null
  // Languages & Chamber affiliation badges
  seHablaEspanol?: boolean
  chamberMember?: boolean
  hispanicChamberMember?: boolean
}

interface HomePageClientProps {
  featuredBusinesses: Business[]
  categoryCounts: Record<string, number>
  latestLifePosts: Array<{
    slug: string
    title: string
    excerpt: string | null
    heroImageUrl: string | null
    publishedAt: string | null
  }>
  upcomingEvents: UpcomingEvent[]
}

export function HomePageClient({ featuredBusinesses, categoryCounts, latestLifePosts, upcomingEvents }: HomePageClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [dockStuck, setDockStuck] = useState(false)
  const dockSentinelRef = useRef<HTMLDivElement | null>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    const q = searchQuery.trim()
    if (q) params.set('q', q)
    setIsSearching(true)
    window.location.href = `/search${params.toString() ? `?${params.toString()}` : ''}`
  }

  // Toggle dock shadow once the sentinel (placed just above the sticky strip
  // on mobile) scrolls out of view.
  useEffect(() => {
    const node = dockSentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => setDockStuck(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // One decision: a single search field and button, plus at most four
  // suggestion chips. The full category list lives in "Browse by Category".
  // Renders inside the photo hero on md+ and in the sticky dock below md.
  const renderFilterChrome = (variant: 'hero' | 'dock') => {
    const formClass =
      variant === 'hero'
        ? 'bg-white rounded-2xl p-2 shadow-2xl max-w-2xl mx-auto'
        : 'bg-white rounded-xl p-1.5 shadow-sm border border-slate-200'
    const pillsClass =
      variant === 'hero'
        ? 'flex flex-wrap justify-center gap-2 mt-6'
        : 'flex flex-wrap gap-2 py-2'
    const pillClass =
      variant === 'hero'
        ? 'text-sm text-white bg-white/15 hover:bg-white/25 px-4 min-h-11 inline-flex items-center rounded-full transition-colors'
        : 'text-sm text-text bg-slate-100 hover:bg-slate-200 px-4 min-h-11 inline-flex items-center rounded-full transition-colors'
    const inputId = `home-search-${variant}`
    return (
      <>
        <form onSubmit={handleSearch} role="search" className={formClass}>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <label htmlFor={inputId} className="sr-only">
                Search Moreno Valley businesses
              </label>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" aria-hidden />
              <input
                id={inputId}
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tacos, plumbers, dentists…"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-text placeholder:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark bg-slate-50"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="btn-accent flex items-center justify-center gap-2 py-3.5 px-8 disabled:opacity-70"
            >
              {isSearching ? 'Searching…' : 'Search'}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </form>

        <div className={pillsClass}>
          {categories.slice(0, 3).map(cat => (
            <Link key={cat.id} href={`/search?category=${cat.slug}`} className={pillClass}>
              {cat.name}
            </Link>
          ))}
          <Link href="/search?espanol=1" className={pillClass}>
            Se habla español
          </Link>
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col">
      {/* ─── HERO ─── */}
      {/* Aerial video over a static poster (the LCP element), a top/bottom navy
          vignette that keeps the headline and search readable while the sunlit
          middle of the aerial stays clear. On mobile the search drops into the
          sticky dock below so it stays reachable while scrolling. */}
      <section className="relative overflow-hidden">
        <HeroVideo
          posterSrc="https://media.moval.living/home/hero-video-poster.jpg"
          posterAlt="Aerial view of Moreno Valley with Box Springs Mountain in the distance"
          webmSrc="https://media.moval.living/home/hero-video.webm"
          mp4Src="https://media.moval.living/home/hero-video.mp4"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, rgba(6,31,46,0.62) 0%, rgba(6,31,46,0.62) 30%, rgba(6,31,46,0) 45%, rgba(6,31,46,0) 55%, rgba(6,31,46,0.62) 70%, rgba(6,31,46,0.62) 100%)',
          }}
        />

        <div className="container-max relative py-16 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight text-balance"
            >
              Your neighbors&apos; guide to{' '}
              <ShimmerText dark>Moreno Valley</ShimmerText>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
              className="text-lg md:text-xl text-white/85 mb-10 max-w-2xl mx-auto"
            >
              The restaurants, shops, events, and stories that make MoVal home, chosen by people who live here.
            </motion.p>

            <div className="hidden md:block">{renderFilterChrome('hero')}</div>
          </div>
        </div>
      </section>

      {/* ─── MOBILE FILTER DOCK ─── */}
      <div ref={dockSentinelRef} aria-hidden="true" className="h-0 md:hidden" />
      <div
        className={`md:hidden sticky top-0 z-30 bg-white transition-shadow ${
          dockStuck ? 'shadow-md border-b border-slate-200' : ''
        }`}
      >
        <div className="container-max py-3">{renderFilterChrome('dock')}</div>
      </div>

      {/* ─── COMING UP — curated events (HERO + HONORABLE_MENTION tier), static
          grid, next 30 days. Section self-hides when empty. ─── */}
      <EventsCallout events={upcomingEvents} />

      {/* ─── FEATURED & BEST OF BUSINESSES ─── */}
      <section className="section bg-white">
        <div className="container-max">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold text-text mb-2">Featured & Best Of Moreno Valley</h2>
              <p className="text-text-secondary">
                Businesses marked <strong className="font-semibold text-text">Featured</strong> are paid placements.{' '}
                <strong className="font-semibold text-text">Best Of</strong> winners and nominees are chosen by community vote.
              </p>
            </div>
            <Link href="/best-of" className="hidden sm:flex items-center gap-1 whitespace-nowrap text-primary font-medium hover:gap-2 transition-all">
              See Best Of <ChevronRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredBusinesses.length === 0 ? (
              <p className="col-span-full text-center text-text-secondary py-12">
                No featured businesses yet.{' '}
                <Link href="/submit" className="text-primary font-medium hover:underline">Be the first to list!</Link>
              </p>
            ) : (
              // Cap at 6: a tight, curated grid beats a wall of cards.
              featuredBusinesses.slice(0, 6).map(business => (
                <BusinessCard key={business.id} business={business} />
              ))
            )}
          </div>
          <div className="sm:hidden mt-6 text-center">
            <Link href="/best-of" className="inline-flex items-center gap-1 text-primary font-medium">
              See Best Of <ChevronRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── LIFE IN MOVAL: the editorial lead. The newest post gets the wide,
          large treatment; the next two stack beside it. Hidden when empty. ─── */}
      {latestLifePosts.length > 0 && (
        <section className="section bg-slate-50">
          <div className="container-max">
            <div className="flex items-end justify-between gap-4 mb-8">
              <div className="max-w-2xl">
                <h2 className="text-3xl md:text-4xl font-bold text-text mb-2">Life in MoVal</h2>
                <p className="text-text-secondary">
                  Observations, outings, and reflections from John Menke on what&apos;s worth noticing in Moreno Valley.
                </p>
              </div>
              <Link href="/life" className="hidden sm:flex items-center gap-1 whitespace-nowrap text-primary font-medium hover:gap-2 transition-all">
                Read all <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {latestLifePosts.slice(0, 3).map((post, i) => {
                const lead = i === 0
                return (
                  <Link
                    key={post.slug}
                    href={`/life/${post.slug}`}
                    className={`group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-primary hover:shadow-lg transition-[box-shadow,border-color] ${
                      lead ? 'lg:col-span-2 lg:row-span-2 flex flex-col' : 'flex flex-col'
                    }`}
                  >
                    {post.heroImageUrl && (
                      <div className={`${lead ? 'aspect-[16/9] lg:aspect-[16/10]' : 'aspect-[16/9]'} overflow-hidden bg-slate-100`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.heroImageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className={lead ? 'p-6 md:p-8' : 'p-6'}>
                      <h3 className={`${lead ? 'text-2xl md:text-3xl' : 'text-lg'} font-bold text-text mb-2 group-hover:text-primary transition-colors text-balance`}>
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className={`text-text-secondary mb-3 ${lead ? 'text-base line-clamp-4' : 'text-sm line-clamp-3'}`}>
                          {post.excerpt}
                        </p>
                      )}
                      {post.publishedAt && (
                        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                          <CalendarIcon className="w-4 h-4" aria-hidden />
                          {new Date(post.publishedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            timeZone: 'America/Los_Angeles',
                          })}
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── BROWSE BY CATEGORY ─── */}
      <section className="section bg-white">
        <div className="container-max">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text mb-3">Browse by Category</h2>
            <p className="text-text-secondary text-lg">Every kind of local business, in one place</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {categories.map(category => {
              const Icon = categoryIcons[category.icon] ?? Building
              const color = categoryColors[category.id] ?? 'var(--color-primary-dark)'
              const count = categoryCounts[category.slug] ?? categoryCounts[category.id] ?? 0
              return (
                <Link
                  key={category.id}
                  href={`/search?category=${category.slug}`}
                  className="group bg-white rounded-xl p-4 flex flex-col items-center text-center gap-3 hover:shadow-lg hover:-translate-y-1 motion-reduce:hover:translate-y-0 transition-[transform,box-shadow] duration-150 border border-slate-100"
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{
                      background: `color-mix(in srgb, ${color} 14%, white)`,
                    }}
                  >
                    <Icon className="w-7 h-7" style={{ color }} strokeWidth={1.75} aria-hidden />
                  </div>
                  <div>
                    <p className="font-semibold text-text text-sm leading-tight">{category.name}</p>
                    <p className="text-sm text-text-secondary mt-1">
                      {count > 0 ? `${count} business${count === 1 ? '' : 'es'}` : 'Browse'}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── RECENT ACTIVITY: static, below the content it supports ─── */}
      <LiveActivityTicker />

      {/* ─── CTA BANNER ─── */}
      <section className="py-16 bg-secondary">
        <div className="container-max text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 text-balance">
            Own a Business in Moreno Valley?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            Listing is free, so neighbors searching for what you do can find you. Upgrade to Featured to appear on the homepage and rank higher in search.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/submit" className="btn-accent px-8 py-3.5 font-bold">
              List My Business Free
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link href="/pricing" className="border-2 border-white/70 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-white/10 hover:border-white transition-colors inline-flex items-center justify-center">
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
