import type { Metadata } from 'next'
import WebDesignClient from './WebDesignClient'

export const metadata: Metadata = {
  title: 'Custom Websites for Local Businesses — MoVal Living',
  description:
    'High-performance websites built for Moreno Valley businesses. Foundation ($97/mo) or Premium ($297/mo) — no setup fee, cancel anytime. Built, hosted, and maintained for you.',
  alternates: { canonical: 'https://www.moval.living/web-design' },
  openGraph: {
    type: 'website',
    url: 'https://www.moval.living/web-design',
    title: 'Custom Websites for Local Businesses — MoVal Living',
    description:
      'High-performance websites built for Moreno Valley businesses. Foundation ($97/mo) or Premium ($297/mo).',
    images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: 'MoVal Living web design' }],
  },
}

const SERVICE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Custom Website Design for Local Businesses',
  provider: {
    '@type': 'Organization',
    name: 'MoVal Living',
    url: 'https://www.moval.living',
  },
  areaServed: {
    '@type': 'City',
    name: 'Moreno Valley',
    addressRegion: 'CA',
    addressCountry: 'US',
  },
  description:
    'Custom websites built, hosted, and maintained for local businesses. Includes missed call text back, review funnels, and local SEO.',
  offers: [
    {
      '@type': 'Offer',
      name: 'Foundation',
      price: '97',
      priceCurrency: 'USD',
      priceValidUntil: '2027-08-26',
      url: 'https://www.moval.living/web-design',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      name: 'Premium',
      price: '297',
      priceCurrency: 'USD',
      priceValidUntil: '2027-08-26',
      url: 'https://www.moval.living/web-design',
      availability: 'https://schema.org/InStock',
    },
  ],
}

export default function WebDesignPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SERVICE_SCHEMA) }}
      />
      <WebDesignClient />
    </>
  )
}
