import Image from 'next/image'
import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import {
  InstagramIcon,
  FacebookIcon,
  LinkedinIcon,
  TiktokIcon,
} from '@/components/social/SocialIcons'
import {
  Trophy,
  Compass,
  Calendar,
  Tag,
  Sparkles,
  Building2,
  DoorOpen,
  Award,
  Info,
} from 'lucide-react'

// Editors edit this array and redeploy. Kept in code (not CMS) because the
// site doesn't use Payload and link changes are tied to seasonal campaigns
// that already trigger redeploys.
const LINKS = [
  {
    label: 'Best of Moreno Valley',
    description: 'Our editors’ top picks — food, services, and local favorites',
    href: '/best-of',
    icon: Trophy,
    accent: 'from-amber-500 to-orange-500',
  },
  {
    label: 'Browse Local Businesses',
    description: 'Restaurants, contractors, healthcare, retail, and more',
    href: '/search',
    icon: Compass,
    accent: 'from-primary to-secondary',
  },
  {
    label: 'Nominate a Business',
    description: 'Suggest a local favorite for Best Of',
    href: '/submit/best-of',
    icon: Award,
    accent: 'from-yellow-500 to-amber-500',
  },
  {
    label: 'Community Events',
    description: 'What’s happening this week in Moreno Valley',
    href: '/events',
    icon: Calendar,
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    label: 'Local Deals',
    description: 'Coupons and offers from neighborhood businesses',
    href: '/deals',
    icon: Tag,
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    label: 'Local Spotlights',
    description: 'Stories behind the businesses that make MoVal home',
    href: '/spotlights',
    icon: Sparkles,
    accent: 'from-sky-500 to-indigo-500',
  },
  {
    label: 'Homes for Sale',
    description: 'Browse Moreno Valley real estate listings',
    href: '/homes',
    icon: Building2,
    accent: 'from-rose-500 to-pink-500',
  },
  {
    label: 'Open Houses',
    description: 'Tour this weekend',
    href: '/open-houses',
    icon: DoorOpen,
    accent: 'from-orange-500 to-red-500',
  },
  {
    label: 'Expert Partners',
    description: 'Trusted local pros',
    href: '/partners',
    icon: Sparkles,
    accent: 'from-purple-500 to-violet-500',
  },
  {
    label: 'About Moreno Valley',
    description: 'Demographics, lifestyle, and what makes the city tick',
    href: '/about-moreno-valley',
    icon: Info,
    accent: 'from-slate-700 to-slate-900',
  },
] as const

const SOCIALS = [
  {
    label: 'Instagram',
    handle: '@moval_living',
    href: 'https://www.instagram.com/moval_living/',
    Icon: InstagramIcon,
    bg: 'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-500',
  },
  {
    label: 'Facebook',
    handle: 'moval.living',
    href: 'https://www.facebook.com/moval.living/',
    Icon: FacebookIcon,
    bg: 'bg-[#1877F2]',
  },
  {
    label: 'LinkedIn',
    handle: 'moval-living',
    href: 'https://www.linkedin.com/company/moval-living',
    Icon: LinkedinIcon,
    bg: 'bg-[#0A66C2]',
  },
  {
    label: 'TikTok',
    handle: '@moval.living',
    href: 'https://www.tiktok.com/@moval.living',
    Icon: TiktokIcon,
    bg: 'bg-black',
  },
] as const

export const metadata: Metadata = {
  title: 'moval.living — Link in Bio',
  description:
    'Every door into moval.living in one place: best of Moreno Valley, local businesses, events, and deals.',
  alternates: { canonical: 'https://www.moval.living/link' },
  openGraph: {
    type: 'website',
    url: 'https://www.moval.living/link',
    title: 'moval.living — Link in Bio',
    description:
      'Every door into moval.living: best of Moreno Valley, local businesses, events, and deals.',
    images: [
      {
        url: '/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'moval.living — Link in Bio',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'moval.living — Link in Bio',
    description:
      'Every door into moval.living: best of Moreno Valley, local businesses, events, and deals.',
    images: ['/og-default.jpg'],
  },
  robots: { index: true, follow: true },
}

// Linktree pages render on mobile first; lock the layout to portrait mobile
// width so social-app preview frames look right.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function LinkInBioPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-12 pt-8 sm:max-w-lg sm:px-6">
        {/* Profile header */}
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-4 h-24 w-24 overflow-hidden rounded-full ring-4 ring-white shadow-lg sm:h-28 sm:w-28">
            <Image
              src="https://movalliving.s3.us-west-1.amazonaws.com/moval-living-logo.png"
              alt="moval.living"
              width={160}
              height={160}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-text sm:text-3xl">
            moval.living
          </h1>
          <p className="mt-1 text-sm font-medium text-primary">
            Moreno Valley, California
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-secondary">
            Your local guide to the businesses, events, and stories that make
            Moreno Valley home.
          </p>
        </header>

        {/* Social row */}
        <nav aria-label="Social profiles" className="mb-8">
          <div className="flex justify-center gap-3">
            {SOCIALS.map(({ label, handle, href, Icon, bg }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${label} — ${handle}`}
                className={`group flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg ${bg}`}
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </nav>

        {/* Link list */}
        <ul className="flex w-full flex-col gap-3">
          {LINKS.map(({ label, description, href, icon: Icon, accent }) => (
            <li key={label}>
              <Link
                href={href}
                className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-transparent hover:shadow-lg"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${accent}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text transition-colors group-hover:text-primary">
                    {label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {description}
                  </p>
                </div>
                <svg
                  className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>

        {/* Email contact — kept here so the page doubles as a low-friction way
                    for press/collabs to reach us without a form */}
                <div className="mt-8 flex justify-center">
                  <a
                    href="mailto:hello@moval.living"
                    className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
                  >
                    hello@moval.living
                  </a>
                </div>

                {/* Footer block */}
                <footer className="mt-6 text-center">
                  <p className="text-xs text-text-secondary">
                    &copy; {new Date().getUTCFullYear()} moval.living
                  </p>
                </footer>
      </main>

      {/* JSON-LD: Person/Organization graph declares the social profiles so IG,
          Facebook, and Google’s social panel can resolve us to the canonical
          accounts. SameAs is what platforms look at to confirm identity. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              '@id': 'https://www.moval.living/#organization',
              name: 'MoVal Living',  // display name (canonical: Title Case)
              url: 'https://www.moval.living',
              logo: 'https://movalliving.s3.us-west-1.amazonaws.com/moval-living-logo.png',
              sameAs: [
                'https://www.instagram.com/moval_living/',
                'https://www.facebook.com/moval.living/',
                'https://www.linkedin.com/company/moval-living',
                'https://www.tiktok.com/@moval.living',
              ],
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              '@id': 'https://www.moval.living/link',
              url: 'https://www.moval.living/link',
              name: 'Link in Bio',
              description:
                'Every door into moval.living in one place: best of Moreno Valley, local businesses, events, and deals.',
              isPartOf: { '@id': 'https://www.moval.living/#website' },
              publisher: { '@id': 'https://www.moval.living/#organization' },
            },
          ]),
        }}
      />
    </div>
  )
}
