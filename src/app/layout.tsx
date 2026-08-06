import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  metadataBase: new URL('https://moval.living'),
  title: {
    default: 'moval.living — Moreno Valley Local Business Directory',
    template: '%s | moval.living',
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
  authors: [{ name: 'moval.living', url: 'https://moval.living' }],
  creator: 'moval.living',
  publisher: 'moval.living',
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
  alternates: {
    canonical: 'https://moval.living',
    languages: { 'en-US': 'https://moval.living' },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://moval.living',
    siteName: 'moval.living',
    title: 'moval.living — Moreno Valley Local Business Directory',
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
    icon: '/favicon.ico',
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
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" />
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
