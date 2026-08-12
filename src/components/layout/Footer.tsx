import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Mail } from 'lucide-react'
import { InstagramIcon, FacebookIcon } from '@/components/social/SocialIcons'

const footerLinks = {
  explore: [
    { label: 'Browse Businesses', href: '/search' },
    { label: 'Best Of', href: '/best-of' },
    { label: 'Community Events', href: '/events' },
    { label: 'Local Deals', href: '/deals' },
    { label: 'Link in Bio', href: '/link' },
  ],
  stories: [
    { label: 'Life in MoVal', href: '/life' },
    { label: 'Live Curiously', href: '/outings' },
    { label: 'Local Spotlights', href: '/spotlights' },
    { label: 'Guest Insights', href: '/insights' },
  ],
  businesses: [
    { label: 'List Your Business', href: '/submit' },
    { label: 'Claim Your Listing', href: '/claim' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Owner Login', href: '/login' },
  ],
  city: [
    { label: 'About MoVal', href: '/about-moreno-valley' },
    { label: 'Homes for Sale', href: '/homes' },
    { label: 'Open Houses', href: '/open-houses' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-text text-white">
      <div className="container-max py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="https://movalliving.s3.us-west-1.amazonaws.com/moval-living-logo.png"
                alt="moval.living"
                width={160}
                height={160}
                className="h-24 w-auto object-contain"
              />
            </Link>
            <p className="mb-6 text-sm leading-relaxed text-slate-400">
              Moreno Valley&apos;s go-to guide for discovering trusted local businesses, stories, events, and experiences.
            </p>
            <div className="space-y-2 text-sm text-slate-400">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                <span>
                  23110 Atlantic Circle, Suite F<br />
                  Moreno Valley, CA 92553
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-secondary" />
                <a href="mailto:hello@moval.living" className="transition-colors hover:text-white">
                  hello@moval.living
                </a>
              </div>
            </div>

            {/* Social — official MoVal accounts. Both open in a new tab. */}
            <div className="mt-6 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Follow</span>
              <a
                href="https://www.instagram.com/moval_living/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="moval.living on Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
              <a
                href="https://www.facebook.com/moval.living/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="moval.living on Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <FacebookIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {[
            { title: 'Explore', links: footerLinks.explore },
            { title: 'Stories', links: footerLinks.stories },
            { title: 'For Businesses', links: footerLinks.businesses },
            { title: 'MoVal', links: footerLinks.city },
          ].map(column => (
            <div key={column.title}>
              <h4 className="mb-4 font-semibold text-white">{column.title}</h4>
              <ul className="space-y-2.5">
                {column.links.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-slate-400 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr className="my-10 border-slate-700" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getUTCFullYear()} moval.living — Moreno Valley Local Business Directory. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="/terms" className="transition-colors hover:text-white">Terms of Service</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy Policy</Link>
            <span>Built with ❤️ for Moreno Valley</span>
          </div>
        </div>
      </div>
    </footer>
  )
}