import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'moval.living — Moreno Valley Local Business Directory',
    template: '%s | moval.living',
  },
  description:
    'Discover trusted local businesses in Moreno Valley, CA. Restaurants, contractors, healthcare, retail and more — all in one place.',
  keywords: ['Moreno Valley business directory', 'local business Moreno Valley', 'MV businesses', 'Moreno Valley CA'],
  openGraph: {
    title: 'moval.living — Moreno Valley Local Business Directory',
    description: 'Your trusted guide to local businesses in Moreno Valley, California.',
    url: 'https://moval.living',
    siteName: 'moval.living',
    locale: 'en_US',
    type: 'website',
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
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
