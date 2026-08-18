import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Moreno Valley Homes for Sale',
  description: 'Browse active Moreno Valley, California homes for sale with current CRMLS listing data, prices, photos, and property details.',
  alternates: { canonical: 'https://www.moval.living/homes' },
  openGraph: {
    title: 'Moreno Valley Homes for Sale',
    description: 'Browse active residential listings in Moreno Valley, CA, powered by CRMLS.',
    url: 'https://www.moval.living/homes',
    type: 'website',
  },
}

export default function HomesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}