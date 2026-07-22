import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Mail, ArrowUpRight } from 'lucide-react'

const footerLinks = {
  directory: [
    { label: 'Browse All', href: '/search' },
    { label: 'Restaurants', href: '/search?category=restaurants' },
    { label: 'Contractors', href: '/search?category=contractors' },
    { label: 'Healthcare', href: '/search?category=healthcare' },
    { label: 'Retail', href: '/search?category=retail' },
  ],
  businesses: [
    { label: 'List Your Business', href: '/submit' },
    { label: 'Claim Your Listing', href: '/claim' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'Owner Login', href: '/login' },
  ],
  company: [
    { label: 'About Us', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-text text-white">
      <div className="container-max py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image src="/logo.png" alt="Moval Living" width={120} height={48} className="object-contain" />
              <span className="text-xl font-bold">
                moval<span className="text-secondary">.living</span>
              </span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Moreno Valley&apos;s go-to directory for discovering trusted local businesses. Connecting our community, one business at a time.
            </p>
            <div className="space-y-2 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-secondary" />
                <span>Moreno Valley, California</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-secondary" />
                <a href="mailto:hello@moval.living" className="hover:text-white transition-colors">
                  hello@moval.living
                </a>
              </div>
            </div>
          </div>

          {/* Directory Links */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Browse</h4>
            <ul className="space-y-2.5">
              {footerLinks.directory.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Businesses Links */}
          <div>
            <h4 className="font-semibold mb-4 text-white">For Businesses</h4>
            <ul className="space-y-2.5">
              {footerLinks.businesses.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Company</h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <hr className="border-slate-700 my-10" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} moval.living — Moreno Valley Local Business Directory. All rights reserved.
          </p>
          <p className="text-sm text-slate-500">
            Built with ❤️ for Moreno Valley
          </p>
        </div>
      </div>
    </footer>
  )
}
