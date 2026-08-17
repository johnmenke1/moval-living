import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Moreno Valley Open Houses',
  description: 'Find upcoming open houses in Moreno Valley, California, with current CRMLS listing data, dates, locations, and map search.',
  alternates: { canonical: 'https://www.moval.living/open-houses' },
  openGraph: {
    title: 'Moreno Valley Open Houses',
    description: 'See upcoming open house dates and active Moreno Valley listings powered by CRMLS.',
    url: 'https://www.moval.living/open-houses',
    type: 'website',
  },
}

export default function OpenHousesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}