import { Suspense } from 'react'
import type { Metadata } from 'next'
import { MarketStats } from '@/components/real estate/MarketStats'
import { MapPin, Users, Briefcase, GraduationCap, Landmark, TreePine, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About Moreno Valley, CA — Demographics, Lifestyle & Market Stats',
  description:
    'Learn about Moreno Valley, CA: population, demographics, top employers, schools, lifestyle, and current real estate market statistics. Your local expert is Johnny Menke, Broker.',
  alternates: {
    types: {
      'text/html': '/about-moreno-valley',
    },
  },
}

async function getStats() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/trestle/stats`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

const DEMOGRAPHICS = [
  {
    icon: Users,
    label: 'Population',
    value: '215,000+',
    sub: 'Riverside County, 2nd largest city',
  },
  {
    icon: TreePine,
    label: 'Median Age',
    value: '33.4',
    sub: 'Young, family-oriented community',
  },
  {
    icon: Briefcase,
    label: 'Median Household Income',
    value: '$72,500',
    sub: 'Above national median',
  },
  {
    icon: GraduationCap,
    label: 'Public Schools',
    value: 'K-12',
    sub: 'Valle Vista USD & Moreno Valley USD',
  },
]

const LIFESTYLE = [
  {
    icon: Landmark,
    label: 'March Air Reserve Base',
    value: 'Historic air reserve base driving local economy & identity',
  },
  {
    icon: TreePine,
    label: 'Hidden Valley Lake',
    value: 'Gated community with lake, golf, and resort amenities',
  },
  {
    icon: MapPin,
    label: 'Prime Location',
    value: '15 min to Riverside • 60 min to LA • 75 min to San Diego • 45 min to Palm Springs',
  },
]

export default async function AboutMorenoValleyPage() {
  const stats = await getStats()

  return (
    <div className="bg-background min-h-screen">
      {/* Hero */}
      <section className="relative bg-secondary text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600&q=80")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative container-max section py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <MapPin className="w-4 h-4" />
              Riverside County, Southern California
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Moreno Valley, California
            </h1>
            <p className="text-xl text-white/80 leading-relaxed">
              A thriving, diverse city of 215,000+ residents in the heart of Southern California.
              Known for its strong community roots, affordable housing, and proximity to
              everything that makes Southern California great — from beaches to mountains to world-class employment.
            </p>
          </div>
        </div>
      </section>

      {/* Demographics */}
      <section className="section bg-white">
        <div className="container-max">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-text mb-2">Demographics at a Glance</h2>
            <p className="text-text-secondary">
              Moreno Valley is one of Riverside County's largest and fastest-growing cities.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DEMOGRAPHICS.map((d) => (
              <div key={d.label} className="card p-5 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <d.icon className="w-6 h-6" />
                </div>
                <div className="text-2xl font-bold text-text mb-0.5">{d.value}</div>
                <div className="text-sm font-semibold text-text mb-1">{d.label}</div>
                <div className="text-xs text-text-secondary">{d.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lifestyle */}
      <section className="section bg-background">
        <div className="container-max">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-text mb-2">Lifestyle & Location</h2>
            <p className="text-text-secondary">
              Moreno Valley sits at the crossroads of convenience and opportunity.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {LIFESTYLE.map((l) => (
              <div key={l.label} className="card p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                    <l.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-text mb-1">{l.label}</div>
                    <p className="text-sm text-text-secondary">{l.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Market Stats */}
      <section className="section bg-white">
        <div className="container-max">
          <Suspense fallback={<MarketStats loading stats={null} />}>
            <MarketStats stats={stats} />
          </Suspense>
        </div>
      </section>

      {/* CTA — Johnny as local expert */}
      <section className="bg-secondary text-white section">
        <div className="container-max text-center">
          <h2 className="text-3xl font-bold mb-4">
            Thinking of Buying or Selling in Moreno Valley?
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
            With years of local market expertise and a deep understanding of the Moreno Valley
            community, Johnny Menke is your trusted real estate broker for the Moreno Valley area.
            Whether you're a first-time buyer, upgrading, or investing, he's here to guide you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://moval.living/submit"
              className="btn-accent inline-flex items-center gap-2"
            >
              Get a Free Home Valuation
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/homes"
              className="btn-outline border-white/30 text-white hover:bg-white/10 hover:text-white"
            >
              Browse Active Listings
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
