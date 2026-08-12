import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  Trophy,
  Calendar,
  Tag,
  Home as HomeIcon,
  DoorOpen,
  Sparkles,
  Info,
  Mail,
  ArrowUpRight,
} from 'lucide-react'
import { InstagramIcon, FacebookIcon, LinkedinIcon, TiktokIcon } from '@/components/social/SocialIcons'

export const metadata: Metadata = {
  title: 'moval.living — Link in Bio',
  description:
    "Moreno Valley's local guide — Best Of picks, events, deals, homes, and more. One link to everything MoVal.",
  alternates: { canonical: 'https://www.moval.living/link' },
  openGraph: {
    type: 'website',
    url: 'https://www.moval.living/link',
    title: 'moval.living — Link in Bio',
    description: "Moreno Valley's local guide — one link to everything MoVal.",
  },
  twitter: {
    card: 'summary',
    title: 'moval.living — Link in Bio',
    description: "Moreno Valley's local guide — one link to everything MoVal.",
  },
}

type Tile = {
  href: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  external?: boolean
}

// External tiles open in a new tab. The Instagram/Facebook handles are the
// official MoVal accounts (instagram.com/moval_living and
// facebook.com/moval.living) — update these if the handles ever change.
const TILES: Tile[] = [
  { href: '/best-of', label: 'Best Of Moreno Valley', description: "Our editors' top picks", icon: Trophy },
  { href: '/events', label: 'Community Events', description: "What's happening in MoVal", icon: Calendar },
  { href: '/deals', label: 'Local Deals', description: 'Discounts from local businesses', icon: Tag },
  { href: '/homes', label: 'Homes for Sale', description: 'Browse Moreno Valley listings', icon: HomeIcon },
  { href: '/open-houses', label: 'Open Houses', description: 'Tour this weekend', icon: DoorOpen },
  { href: '/partners', label: 'Expert Partners', description: 'Trusted local pros', icon: Sparkles },
  { href: '/about-moreno-valley', label: 'About MoVal', description: 'Demographics & lifestyle', icon: Info },
  {
    href: 'https://www.instagram.com/moval_living/',
    label: 'Instagram',
    description: '@moval_living',
    icon: InstagramIcon as unknown as React.ComponentType<{ className?: string }>,
    external: true,
  },
  {
    href: 'https://www.facebook.com/moval.living/',
    label: 'Facebook',
    description: 'moval.living',
    icon: FacebookIcon as unknown as React.ComponentType<{ className?: string }>,
    external: true,
  },
  {
    href: 'https://www.linkedin.com/company/moval-living',
    label: 'LinkedIn',
    description: 'moval.living',
    icon: LinkedinIcon as unknown as React.ComponentType<{ className?: string }>,
    external: true,
  },
  {
    href: 'https://www.tiktok.com/@moval.living',
    label: 'TikTok',
    description: '@moval.living',
    icon: TiktokIcon as unknown as React.ComponentType<{ className?: string }>,
    external: true,
  },
  {
    href: 'mailto:hello@moval.living',
    label: 'Email Us',
    description: 'hello@moval.living',
    icon: Mail,
    external: true,
  },
]

export default function LinkInBioPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-white to-secondary/5">
      <div className="container-max py-12 sm:py-16">
        <div className="mx-auto max-w-md">
          {/* Brand card */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-5 h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg sm:h-32 sm:w-32">
              <Image
                src="https://movalliving.s3.us-west-1.amazonaws.com/moval-living-logo.png"
                alt="moval.living"
                width={200}
                height={200}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-text sm:text-3xl">moval.living</h1>
            <p className="mt-2 max-w-sm text-sm text-text-secondary sm:text-base">
              Moreno Valley&apos;s local guide — one link to everything MoVal.
            </p>
          </div>

          {/* Link tiles */}
          <div className="mt-10 space-y-3">
            {TILES.map(tile => (
              <Link
                key={tile.href}
                href={tile.href}
                {...(tile.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <tile.icon className="h-5 w-5" />
                </span>
                <span className="flex-1 min-w-0 text-left">
                  <span className="block font-semibold text-text">{tile.label}</span>
                  <span className="block text-xs text-text-secondary">{tile.description}</span>
                </span>
                {tile.external && (
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-text-secondary transition-colors group-hover:text-primary" />
                )}
              </Link>
            ))}
          </div>

          {/* Footer credit */}
          <p className="mt-10 text-center text-xs text-text-secondary">
            Built with ❤️ for Moreno Valley
          </p>
        </div>
      </div>
    </div>
  )
}