'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, X, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Browse', href: '/search' },
  { label: 'Homes', href: '/homes' },
  { label: 'Events', href: '/events' },
  { label: 'About MoVal', href: '/about-moreno-valley' },
  { label: 'Deals', href: '/deals', icon: Tag },
  { label: 'Submit Business', href: '/submit' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white shadow-sm">
      <div className="container-max">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="group flex items-center gap-2">
            <Image
              src="/navbar-logo.png"
              alt="Moval Living"
              width={280}
              height={40}
              className="object-contain transition-transform group-hover:scale-105"
            />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-primary"
              >
                {link.icon && <link.icon className="h-4 w-4" />}
                {link.label}
              </Link>
            ))}
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
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-4 py-3 text-base font-medium text-text-secondary transition-colors hover:bg-slate-50 hover:text-primary"
            >
              {link.icon && <link.icon className="mr-2 inline h-4 w-4" />}
              {link.label}
            </Link>
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
