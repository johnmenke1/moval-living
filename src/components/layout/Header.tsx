'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  BookOpen,
  Calendar,
  ChevronDown,
  Compass,
  DollarSign,
  FileText,
  Home as HomeIcon,
  Menu,
  Sparkles,
  Tag,
  Trophy,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Explore',
    icon: Compass,
    items: [
      { label: 'Browse Businesses', href: '/search', icon: Compass },
      { label: 'Best Of Moreno Valley', href: '/best-of', icon: Trophy },
      { label: 'Community Events', href: '/events', icon: Calendar },
      { label: 'Local Deals', href: '/deals', icon: Tag },
      { label: 'Local Spotlights', href: '/spotlights', icon: Sparkles },
    ],
  },
  {
    label: 'Stories',
    icon: BookOpen,
    items: [
      { label: 'Life in MoVal', href: '/life', icon: BookOpen },
      { label: 'Live Curiously', href: '/outings', icon: Compass },
      { label: 'Guest Insights', href: '/insights', icon: FileText },
    ],
  },
  {
    label: 'Homes',
    icon: HomeIcon,
    items: [
      { label: 'Homes for Sale', href: '/homes', icon: HomeIcon },
      { label: 'Open Houses', href: '/open-houses', icon: Calendar },
    ],
  },
  {
    label: 'About',
    icon: Compass,
    items: [
      { label: 'Expert Partners', href: '/partners', icon: Sparkles },
      { label: 'Pricing', href: '/pricing', icon: DollarSign },
    ],
  },
]

const standaloneNavLinks: { label: string; href: string; icon: typeof Compass }[] = []

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const closeNavigation = () => {
    setMobileOpen(false)
    setOpenMenu(null)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white shadow-sm">
      <div className="container-max">
        <div className="flex h-16 items-center justify-between gap-6">
          <Link href="/" className="group flex shrink-0 items-center" onClick={closeNavigation}>
            <Image
              src="https://movalliving.s3.us-west-1.amazonaws.com/moval-living-logo-nav.png"
              alt="moval.living"
              width={280}
              height={40}
              priority
              className="h-10 w-auto max-w-[52vw] object-contain transition-transform group-hover:scale-105"
            />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {navGroups.map(group => (
              <div key={group.label} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === group.label ? null : group.label)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
                  aria-expanded={openMenu === group.label}
                  aria-haspopup="true"
                >
                  <group.icon className="h-4 w-4" />
                  {group.label}
                  <ChevronDown className={cn('h-4 w-4 transition-transform', openMenu === group.label && 'rotate-180')} />
                </button>

                {openMenu === group.label && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-100 bg-white p-2 shadow-xl">
                    {group.items.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeNavigation}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {standaloneNavLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeNavigation}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden shrink-0 items-center gap-3 lg:flex">
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

      <div
        id="mobile-navigation"
        className={cn(
          'fixed inset-x-0 bottom-0 top-16 z-[60] overflow-y-auto border-t border-slate-200 bg-white shadow-2xl transition-all duration-200 lg:hidden',
          mobileOpen
            ? 'visible translate-y-0 opacity-100 pointer-events-auto'
            : 'invisible -translate-y-2 opacity-0 pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <nav className="flex min-h-full flex-col gap-5 bg-white p-6 text-text" aria-label="Mobile navigation">
          {navGroups.map(group => (
            <div key={group.label}>
              <div className="mb-2 flex items-center gap-2 px-4 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                <group.icon className="h-4 w-4" />
                {group.label}
              </div>
              <div className="flex flex-col gap-1">
                {group.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeNavigation}
                    className="rounded-lg px-4 py-2.5 text-base font-medium text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {standaloneNavLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeNavigation}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-base font-medium text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}

          <hr className="border-slate-100" />
          <Link
            href="/login"
            onClick={closeNavigation}
            className="rounded-lg px-4 py-2.5 text-base font-medium text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
          >
            Sign In
          </Link>
          <Link href="/submit" onClick={closeNavigation} className="btn-accent text-center">
            List Your Business
          </Link>
        </nav>
      </div>
    </header>
  )
}
