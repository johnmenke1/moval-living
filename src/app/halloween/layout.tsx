import type { Metadata } from 'next'
import { Creepster } from 'next/font/google'

const creepster = Creepster({ subsets: ['latin'], weight: '400', variable: '--font-halloween' })

export const metadata: Metadata = {
  title: 'MoVal Haunted Homes - Halloween Home Decorating Contest',
  description:
    'Moreno Valley\'s Halloween home decorating contest, hosted by American Legion Post 574. Enter your haunted house, explore the map, and vote for your favorite.',
  alternates: { canonical: 'https://www.moval.living/halloween' },
  openGraph: {
    title: 'MoVal Haunted Homes - Halloween Home Decorating Contest',
    description: 'Explore Moreno Valley\'s spookiest homes on the map and vote for your favorite. Hosted by American Legion Post 574.',
    url: 'https://www.moval.living/halloween',
    type: 'website',
  },
}

export default function HalloweenLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`${creepster.variable} min-h-screen text-white`}
      style={{ background: 'radial-gradient(1200px 500px at 50% -10%, #3b1566 0%, #1a0b2e 45%, #0b0613 100%)' }}
    >
      <style>{`.font-halloween{font-family:var(--font-halloween),Georgia,serif;letter-spacing:.02em}`}</style>
      {children}
    </div>
  )
}
