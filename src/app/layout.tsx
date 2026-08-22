import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import { Inter, Fraunces } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

// Warm display serif for headings — gives the site an editorial, "local
// paper" personality that all-Inter never could. Body copy stays Inter.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz'],
})

// The root tree includes NextAuth's SessionProvider (in a 'use client'
// boundary at src/components/Providers.tsx, so it doesn't require a
// request work store). The previous 'force-dynamic' here was defensive
// against an early Next.js 16 + NextAuth incompatibility where metadata
// evaluation needed a request context, but it also propagated to every
// child route and broke per-page ISR — the homepage's revalidate=300
// (set in src/app/page.tsx) was being overridden, so every visit hit
// the DB. Removing the override lets each route decide its own cache
// strategy. If the original Next.js 16 symptom resurfaces, the right
// fix is a more targeted dynamic = 'force-dynamic' on the specific
// route that needs it, not a global override.
// export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.moval.living'),
  // Canonical brand convention (verified 2026-08-22, Johnny):
  //   name:    'MoVal Living'  (display name, Title Case)
  //   url:     'https://www.moval.living'  (technical URL, lowercase)
  //   email:   'hello@moval.living'  (contact, lowercase)
  // URL slugs and the template suffix use the lowercase form; the
  // display name in titles, OG metadata, and Schema.org `name` uses
  // 'MoVal Living'. Per-page titles should NOT include the brand in
  // their text — the template below appends ' | MoVal Living' for them.
  title: {
    default: 'MoVal Living — Moreno Valley Local Business Directory',
    template: '%s | MoVal Living',
  },
  description:
    'Discover trusted local businesses in Moreno Valley, CA. Restaurants, contractors, healthcare, retail and more — all in one place.',
  keywords: [
    'Moreno Valley business directory',
    'local business Moreno Valley',
    'MV businesses',
    'Moreno Valley CA',
    'Moreno Valley restaurants',
    'Moreno Valley contractors',
    'Moreno Valley healthcare',
    'Moreno Valley shopping',
  ],
  authors: [{ name: 'MoVal Living', url: 'https://www.moval.living' }],
  creator: 'MoVal Living',
  publisher: 'MoVal Living',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.moval.living',
    siteName: 'MoVal Living',
    title: 'MoVal Living — Moreno Valley Local Business Directory',
    description: 'Your trusted guide to local businesses in Moreno Valley, California.',
    images: [
      {
        url: '/og-default.jpg',
        width: 1200,
        height: 630,
        alt: 'moval.living — Moreno Valley Local Business Directory',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@movaliving',
    creator: '@movaliving',
    title: 'moval.living — Moreno Valley Local Business Directory',
    description: 'Discover trusted local businesses in Moreno Valley, CA.',
    images: ['/og-default.jpg'],
  },
  icons: {
    icon: 'https://movalliving.s3.us-west-1.amazonaws.com/favicon.ico',
  },
  verification: {
    google: 'S3x3tSSSnJkEWc0o7DwlAeMiH1qED6wLMkawBkaUOJ4',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <link rel="icon" href="https://movalliving.s3.us-west-1.amazonaws.com/favicon.ico" />
        {/* Geo meta tags — recognized by search engines for local intent */}
        <meta name="geo.region" content="US-CA" />
        <meta name="geo.placename" content="Moreno Valley" />
        <meta name="geo.position" content="33.9425;-117.2297" />
        <meta name="ICBM" content="33.9425, -117.2297" />
        {/* Theme color for mobile browser chrome */}
        <meta name="theme-color" content="#007a7f" />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
