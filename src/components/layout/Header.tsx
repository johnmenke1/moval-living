'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Browse', href: '/search' },
  { label: 'Submit Business', href: '/submit' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="container-max">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <Image
              src="/navbar-logo.png"
              alt="Moval Living"
              width={280}
              height={40}
              className="object-contain group-hover:scale-105 transition-transform"
            />
            <span className="text-xl font-bold text-text">
              moval<span className="text-primary">.living</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-text-secondary hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-text-secondary hover:text-primary transition-colors">
              Sign In
            </Link>
            <Link href="/submit" className="btn-accent text-sm py-2 px-4">
              List Your Business
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'md:hidden fixed inset-0 top-16 bg-white z-40 transition-all duration-200',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <nav className="flex flex-col p-6 gap-2">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-base font-medium text-text-secondary hover:text-primary py-3 px-4 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <hr className="my-2 border-slate-100" />
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="text-base font-medium text-text-secondary hover:text-primary py-3 px-4 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/submit"
            onClick={() => setMobileOpen(false)}
            className="btn-accent text-center mt-2"
          >
            List Your Business
          </Link>
        </nav>
      </div>
    </header>
  )
}
