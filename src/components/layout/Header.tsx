'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Menu,
  X,
  Tag,
  Trophy,
  Calendar,
  FileText,
  Sparkles,
  Compass,
  Home as HomeIcon,
  MapPin,
  CalendarDays,
  Trees,
  Heart,
  Info,
  DollarSign,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const topLinks = [
  { label: 'Home', href: '/' },
  { label: 'Browse', href: '/search' },
  { label: 'Best Of', href: '/best-of', icon: Trophy },
]

const exploreGroups = [
  {
    label: 'Discover',
    items: [
      { label: 'Homes for Sale', href: '/homes', icon: HomeIcon },
      { label: 'Open Houses', href: '/open-houses', icon: Calendar },
      { label: 'Events', href: '/events', icon: CalendarDays },
      { label: 'Outings', href: '/outings', icon: Compass },
      { label: 'Life in MoVal', href: '/life', icon: Heart },
      { label: 'Deals', href: '/deals', icon: Tag },
    ],
  },
  {
    label: 'Read',
    items: [
      { label: 'Insights', href: '/insights', icon: FileText },
      { label: 'Spotlights', href: '/spotlights', icon: Sparkles },
    ],
  },
  {
    label: 'About',
    items: [
      { label: 'About MoVal', href: '/about-moreno-valley', icon: Info },
      { label: 'Pricing', href: '/pricing', icon: DollarSign },
    ],
  },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [exploreOpen, setExploreOpen] = useState(false)
  const exploreRef = useRef<HTMLDivElement>(null)

  // Close Explore dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!exploreOpen) return
    const onClick = (e: MouseEvent) => {
      if (exploreRef.current && !exploreRef.current.contains(e.target as Node)) {
        setExploreOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExploreOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [exploreOpen])

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white shadow-sm">
      <div className="container-max">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="group flex items-center gap-2">
            <Image
              src="https://movalliving.s3.us-west-1.amazonaws.com/moval-living-logo-nav.png"
              alt="moval.living"
              width={280}
              height={40}
              priority
              className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {topLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-primary"
              >
                {link.icon && <link.icon className="h-4 w-4" />}
                {link.label}
              </Link>
            ))}

            {/* Explore dropdown */}
            <div className="relative" ref={exploreRef}>
              <button
                type="button"
                onClick={() => setExploreOpen(o => !o)}
                aria-expanded={exploreOpen}
                aria-haspopup="true"
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium transition-colors',
                  exploreOpen ? 'text-primary' : 'text-text-secondary hover:text-primary',
                )}
              >
                Explore
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', exploreOpen && 'rotate-180')}
                />
              </button>

              {exploreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-3 w-64 rounded-xl border border-slate-100 bg-white p-2 shadow-xl"
                >
                  {exploreGroups.map((group, gi) => (
                    <div key={group.label} className={gi > 0 ? 'mt-1 border-t border-slate-100 pt-2' : ''}>
                      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {group.label}
                      </p>
                      <div className="flex flex-col">
                        {group.items.map(item => (
                          <Link
                            key={item.href}
                            href={item.href}
                            role="menuitem"
                            onClick={() => setExploreOpen(false)}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
                          >
                            <item.icon className="h-4 w-4 text-slate-400" />
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link href="/login" className="text-sm font-medium text-text-secondary transition-colors hover:text-primary">
              Sign In
            </Link>
            <Link href="/submit" className="btn-accent px-4 py-2 text-sm">
              List Your Business
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(open => !open)}
            className="rounded-lg p-2 text-text transition-colors hover:bg-slate-100 lg:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <div
        id="mobile-navigation"
        className={cn(
          'fixed inset-x-0 bottom-0 top-16 z-[60] overflow-y-auto border-t border-slate-200 bg-white shadow-2xl transition-all duration-200 lg:hidden',
          mobileOpen
            ? 'visible translate-y-0 opacity-100 pointer-events-auto'
            : 'invisible -translate-y-2 opacity-0 pointer-events-none',
        )}
        style={{ backgroundColor: '#ffffff' }}
        aria-hidden={!mobileOpen}
      >
        <nav className="flex min-h-full flex-col gap-1 bg-white p-6 text-text">
          {topLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
            >
              {link.icon && <link.icon className="h-4 w-4" />}
              {link.label}
            </Link>
          ))}

          {exploreGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-3 border-t border-slate-100 pt-3' : 'mt-3 border-t border-slate-100 pt-3'}>
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              {group.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-base font-medium text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
                >
                  <item.icon className="h-4 w-4 text-slate-400" />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}

          <hr className="my-3 border-slate-100" />
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg px-4 py-3 text-base font-medium text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
          >
            Sign In
          </Link>
          <Link href="/submit" onClick={() => setMobileOpen(false)} className="btn-accent mt-2 text-center">
            List Your Business
          </Link>
        </nav>
      </div>
    </header>
  )
}
