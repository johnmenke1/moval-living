'use client'

/**
 * SearchHeroClient — photo hero for /search.
 *
 * Same layered stack as the homepage hero (full-bleed photo → dark+brand
 * gradient → ambient blobs → centered content), with ShimmerText on the
 * headline's accent phrase and a staggered fade-up entry on mount.
 *
 * Animation is on-mount only (not scroll-triggered) because the hero is
 * the visual entry point — deferring it would hurt perceived perf.
 *
 * Houses the search input + filter chrome that used to live in the old
 * "header card" + sticky bar (now consolidated per Aug 27 direction).
 * The page server-component passes down the same SearchFilters +
 * CompactSearchBar that used to live in those two slots.
 */

import { motion } from 'framer-motion'
import { MapPin, Search } from 'lucide-react'
import { ShimmerText } from '@/components/motion'

interface SearchHeroClientProps {
  /** Eyebrow pill (e.g. 'Search results', 'Category', 'Local Business Directory'). */
  eyebrow: string
  /** Headline split into three segments so the client can wrap the middle
   *  one in <ShimmerText>. Empty strings render as nothing — keeps the
   *  server as source of truth for SEO while the client owns the
   *  animation primitive. */
  titleBefore: string
  titleAccent: string
  titleAfter: string
  /** Sub-copy under the headline. Pre-computed by the server so
   *  answer-capsule content stays in the server-rendered HTML. */
  subtitle: React.ReactNode
  /** Search input + language toggle + clear-all (was CompactSearchBar). */
  compactSearchBar: React.ReactNode
  /** Category dropdown + jump-to pills (was SearchFilters). */
  searchFilters: React.ReactNode
}

export function SearchHeroClient({
  eyebrow,
  titleBefore,
  titleAccent,
  titleAfter,
  subtitle,
  compactSearchBar,
  searchFilters,
}: SearchHeroClientProps) {
  return (
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
      {/* Dark overlay for headline readability + brand teal tint.
          Slightly lighter than the original /85-/80-/75 so the cityscape
          photo reads through and the headline shimmer has air to breathe. */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/75 via-[#01566d]/70 to-primary/65" />
      {/* Brand accent blobs (lifted opacity so they register against the
          lighter overlay without overpowering the photo or headline). */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/20 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

      <div className="container-max relative py-14 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-sm px-4 py-1.5 rounded-full mb-5"
          >
            <MapPin className="w-4 h-4 text-[#8fd4d7]" />
            Moreno Valley, California
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4"
          >
            <Search className="w-3 h-3 text-[#8fd4d7]" />
            {eyebrow}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 leading-tight"
          >
            {titleBefore}
            {titleAccent && <ShimmerText dark>{titleAccent}</ShimmerText>}
            {titleAfter}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            className="text-base md:text-lg text-white/80 mb-8 max-w-2xl mx-auto"
          >
            {subtitle}
          </motion.p>

          {/* Consolidated search chrome — was header card + sticky bar.
              Single source of truth for filtering /search. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
            className="space-y-5"
          >
            <div className="bg-white rounded-2xl p-2 shadow-2xl max-w-2xl mx-auto">
              {compactSearchBar}
            </div>
            <div className="max-w-2xl mx-auto text-white/90">
              {searchFilters}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
