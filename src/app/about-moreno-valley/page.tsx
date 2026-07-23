import type { Metadata } from 'next'
import { computeMorenoValleyMarketStats } from '@/lib/market-stats'
import { MarketStats } from '@/components/real estate/MarketStats'
import { MapPin, Users, Briefcase, GraduationCap, Landmark, TreePine, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About Moreno Valley, CA — Demographics, Lifestyle & Market Stats',
  description:
    'Learn about Moreno Valley, CA: population, demographics, top employers, schools, lifestyle, and current real estate market statistics. Your local expert is Johnny Menke, Broker.',
}

export const revalidate = 3600

const DEMOGRAPHICS = [
  { icon: Users, label: 'Population', value: '215,000+', sub: 'Riverside County, 2nd largest city' },
  { icon: TreePine, label: 'Median Age', value: '33.4', sub: 'Young, family-oriented community' },
  { icon: Briefcase, label: 'Median Household Income', value: '$72,500', sub: 'Above national median' },
  { icon: GraduationCap, label: 'Public Schools', value: 'K-12', sub: 'Valle Vista USD & Moreno Valley USD' },
]

const LIFESTYLE = [
  { icon: Landmark, label: 'March Air Reserve Base', value: 'Historic air reserve base driving local economy & identity' },
  { icon: TreePine, label: 'Hidden Valley Lake', value: 'Gated community with lake, golf, and resort amenities' },
  { icon: MapPin, label: 'Prime Location', value: '15 min to Riverside • 60 min to LA • 75 min to San Diego • 45 min to Palm Springs' },
]

export default async function AboutMorenoValleyPage() {
  let stats = null
  let statsError: string | null = null
  try {
    stats = await computeMorenoValleyMarketStats()
  } catch (error) {
    console.error('[about-moreno-valley] Market stats error:', error)
    statsError = error instanceof Error ? error.message : 'Unknown error'
  }

  return (
    <div className="bg-background min-h-screen">
      <section className="relative overflow-hidden bg-secondary text-white">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600&q=80")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="container-max relative section py-20">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
              <MapPin className="h-4 w-4" /> Riverside County, Southern California
            </div>
            <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl">Moreno Valley, California</h1>
            <p className="text-xl leading-relaxed text-white/80">
              A thriving, diverse city of 215,000+ residents in the heart of Southern California.
              Known for its strong community roots, affordable housing, and proximity to
              everything that makes Southern California great — from beaches to mountains to world-class employment.
            </p>
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-max">
          <div className="mb-8">
            <h2 className="mb-2 text-3xl font-bold text-text">Demographics at a Glance</h2>
            <p className="text-text-secondary">Moreno Valley is one of Riverside County&apos;s largest and fastest-growing cities.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {DEMOGRAPHICS.map(item => (
              <div key={item.label} className="card p-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="mb-0.5 text-2xl font-bold text-text">{item.value}</div>
                <div className="mb-1 text-sm font-semibold text-text">{item.label}</div>
                <div className="text-xs text-text-secondary">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-background">
        <div className="container-max">
          <div className="mb-8">
            <h2 className="mb-2 text-3xl font-bold text-text">Lifestyle &amp; Location</h2>
            <p className="text-text-secondary">Moreno Valley sits at the crossroads of convenience and opportunity.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {LIFESTYLE.map(item => (
              <div key={item.label} className="card p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="mb-1 font-semibold text-text">{item.label}</div>
                    <p className="text-sm text-text-secondary">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-max">
          <MarketStats stats={stats} error={statsError} />
        </div>
      </section>

      <section className="bg-secondary section text-white">
        <div className="container-max text-center">
          <h2 className="mb-4 text-3xl font-bold">Thinking of Buying or Selling in Moreno Valley?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/70">
            With years of local market expertise and a deep understanding of the Moreno Valley
            community, Johnny Menke is your trusted real estate broker for the Moreno Valley area.
            Whether you&apos;re a first-time buyer, upgrading, or investing, he&apos;s here to guide you.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a href="/homes" className="btn-accent inline-flex items-center gap-2">
              Browse Active Listings <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/about-moreno-valley#contact" className="btn-outline border-white/30 text-white hover:bg-white/10 hover:text-white">
              Talk to Johnny
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
