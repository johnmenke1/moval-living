'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Search,
  MapPin,
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
  type LucideIcon,
} from 'lucide-react'
import { categories } from '@/data/categories'
import { BusinessCard } from '@/components/business/BusinessCard'
import { EventsCallout, type UpcomingEvent } from '@/components/home/EventsCallout'
import LiveActivityTicker from '@/components/home/LiveActivityTicker'
import { Calendar } from 'lucide-react'

// Constrained to four brand-adjacent hues (teal, navy, terracotta, warm
// gold) instead of 22 arbitrary rainbow colors — the grid reads as one
// designed system while icons still vary enough to scan.
const categoryColors: Record<string, string> = {
  restaurants: '#c9786d',
  contractors: '#00405c',
  healthcare: '#007a7f',
  retail: '#b08a3e',
  'auto-repair': '#00405c',
  'auto-dealers': '#00405c',
  churches: '#007a7f',
  'property-management': '#00405c',
  'non-profits': '#c9786d',
  'supply-logistics': '#00405c',
  entertainment: '#b08a3e',
  professional: '#00405c',
  beauty: '#c9786d',
  'home-services': '#007a7f',
  education: '#b08a3e',
  pets: '#007a7f',
  finance: '#00405c',
  'real-estate': '#007a7f',
  insurance: '#00405c',
  dispensaries: '#007a7f',
  hospitality: '#b08a3e',
  'service-clubs': '#c9786d',
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
  const [selectedCategory, setSelectedCategory] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (selectedCategory) params.set('category', selectedCategory)
    window.location.href = `/search?${params.toString()}`
  }

  return (
    <div className="flex flex-col">
      {/* ─── HERO ─── */}
      {/* Layered stack: cityscape photo underneath, dark+brand gradient on top
          (keeps the white headline readable and preserves the brand palette),
          then the two decorative blur blobs as the brand's signature accent.
          The photo is the LCP element — eager-loaded with high fetch priority. */}
      <section className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://zcbtyeiwows1rc8s.public.blob.vercel-storage.com/home/home-hero-1786913867250.jpg"
          alt="Aerial view of Moreno Valley with Box Springs Mountain in the distance"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        {/* Dark overlay for headline readability + brand teal tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/85 via-[#01566d]/80 to-primary/75" />
        {/* Brand accent blobs (kept at lower opacity so the photo shows through) */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/15 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

        <div className="container-max relative py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-sm px-4 py-1.5 rounded-full mb-6">
              <MapPin className="w-4 h-4 text-[#8fd4d7]" />
              Moreno Valley, California
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Your neighbors&apos; guide to{' '}
              <span className="text-[#8fd4d7]">Moreno Valley</span>
            </h1>

            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
              The restaurants, shops, events, and stories that make MoVal home — curated by locals, for locals.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl p-2 shadow-2xl max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="What are you looking for?"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl text-text placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="sm:w-48 px-4 py-3.5 rounded-xl text-text bg-slate-50 border-0 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
                <button type="submit" className="btn-accent flex items-center justify-center gap-2 py-3.5 px-8">
                  Search
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Quick category pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {categories.slice(0, 5).map(cat => (
                <Link
                  key={cat.id}
                  href={`/search?category=${cat.slug}`}
                  className="text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-all duration-150"
                >
                  {cat.name}
                </Link>
              ))}
              <Link
                href="/search?espanol=1"
                className="text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-all duration-150"
              >
                Se habla español
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── EVENTS CALLOUT ─── */}
      {/* Sits between the Hero and the live-activity ticker so visitors
          see what’s coming up in the community before they reach the
          Featured & Best-Of grid. Hidden entirely when no upcoming
          events exist (handled inside the component). */}
      <EventsCallout events={upcomingEvents} />

      {/* ─── LIVE ACTIVITY TICKER ─── */}
      {/* "MoVal right now" — shows recent claims, upgrades, reviews, and
          nominations. Lazy-fetches from /api/public/live-activity on the
          client, auto-rotates every 7s. Placement: between hero and the
          Featured grid so it's visible on first paint but doesn't compete
          with the search bar. */}
      <LiveActivityTicker />

      {/* ─── FEATURED & BEST OF BUSINESSES ─── */}
      <section className="section bg-white">
        <div className="container-max">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-text mb-1">Featured &amp; Best Of Moreno Valley</h2>
              <p className="text-text-secondary">Curated Featured businesses and Best-Of winners across the community</p>
            </div>
            <Link href="/best-of" className="hidden sm:flex items-center gap-1 text-primary font-medium hover:gap-2 transition-all">
              See Best Of <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredBusinesses.length === 0 ? (
              <p className="col-span-3 text-center text-text-secondary py-12">
                No featured businesses yet.{' '}
                <Link href="/submit" className="text-primary font-medium hover:underline">Be the first to list!</Link>
              </p>
            ) : (
              // Cap at 6 — a tight, curated grid beats a wall of thirteen
              // cards where half are letter-placeholder tiles.
              featuredBusinesses.slice(0, 6).map(business => (
                <BusinessCard key={business.id} business={business} />
              ))
                          )}
                        </div>
                      </div>
                    </section>

                    {/* ─── EVENTS CALLOUT — promotes /events from the homepage ─── */}
                    {/* Sits between Featured and Life so visitors see local events as
                        a distinct content lane (not just another business grid). Hero +
                        + Honorable Mention tier only — curated, not a calendar dump.
                        Window is today + 30 days so regional shows (RMA, Fox) booked
                        weeks out are still discoverable. Section self-hides when empty. */}
                    <EventsCallout events={upcomingEvents} />

                    {/* ─── LIFE IN MOVAL — EDITORIAL CALLOUT ─── */}
      {/* Pulls the most recent "Life in MoVal" posts so visitors see the
          editorial lane and Google gets an internal-link into /life. Section
          only renders when at least one LIFE post exists — silently hidden
          when the lane is empty so the homepage doesn't show an empty grid. */}
      {latestLifePosts.length > 0 && (
        <section className="section bg-slate-50">
          <div className="container-max">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-text mb-1">Life in MoVal</h2>
                <p className="text-text-secondary">
                  Observations, outings, and reflections from John Menke — what&apos;s worth noticing in Moreno Valley.
                </p>
              </div>
              <Link href="/life" className="hidden sm:flex items-center gap-1 text-primary font-medium hover:gap-2 transition-all">
                Read all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestLifePosts.map(post => (
                <Link
                  key={post.slug}
                  href={`/life/${post.slug}`}
                  className="group bg-white rounded-xl border border-slate-100 overflow-hidden hover:border-primary hover:shadow-lg transition-all"
                >
                  {post.heroImageUrl && (
                    <div className="block aspect-[16/9] overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.heroImageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-text mb-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-sm text-text-secondary mb-3 line-clamp-3">{post.excerpt}</p>
                    )}
                    {post.publishedAt && (
                      <div className="flex items-center gap-1 text-xs text-text-secondary">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.publishedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── BROWSE BY CATEGORY ─── */}
      <section className="section bg-white">
        <div className="container-max">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text mb-3">Browse by Category</h2>
            <p className="text-text-secondary text-lg">Find exactly what you need — fast</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {categories.map(category => {
              const Icon = categoryIcons[category.icon] ?? Building
              const color = categoryColors[category.id] ?? '#007a7f'
              const count = categoryCounts[category.slug] ?? categoryCounts[category.id] ?? 0
              return (
                <Link
                  key={category.id}
                  href={`/search?category=${category.slug}`}
                  className="group bg-white rounded-xl p-4 flex flex-col items-center text-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all duration-150 border border-slate-100"
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${color}15, ${color}30)`,
                    }}
                  >
                    <Icon className="w-7 h-7" style={{ color }} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="font-semibold text-text text-sm leading-tight">{category.name}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      {count > 0 ? `${count} business${count === 1 ? '' : 'es'}` : 'Browse →'}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      {/* Solid brand navy with a single terracotta-adjacent action — the old
          orange gradient shouted against the muted palette. */}
      <section className="py-16 bg-secondary">
        <div className="container-max text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Own a Business in Moreno Valley?
          </h2>
          <p className="text-white/75 text-lg mb-8 max-w-2xl mx-auto">
            Get listed for FREE and reach thousands of local customers. Upgrade to Featured to appear on the homepage and rank higher in search.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/submit" className="bg-accent text-white font-bold px-8 py-3.5 rounded-lg hover:bg-[#b96a5f] transition-colors inline-flex items-center justify-center gap-2">
              List My Business Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="border-2 border-white/60 text-white font-bold px-8 py-3.5 rounded-lg hover:bg-white/10 hover:border-white transition-colors inline-flex items-center justify-center">
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
