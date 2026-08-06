import type { Metadata } from 'next'
import Image from 'next/image'
import { computeMorenoValleyMarketStats } from '@/lib/market-stats'
import { MarketStats } from '@/components/real estate/MarketStats'
import { MapPin, Users, Briefcase, GraduationCap, Landmark, TreePine, ArrowRight } from 'lucide-react'
import { FaqSection } from '@/components/seo/FaqSection'

export const metadata: Metadata = {
  title: 'About Moreno Valley, CA — Demographics, Lifestyle & Market Stats',
  description:
    'Learn about Moreno Valley, CA: population, demographics, top employers, schools, lifestyle, and current real estate market stats. Founded by 30-year Moreno Valley resident John Menke (DRE #01959317).',
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

      {/* ── Meet the Founder ──────────────────────────────────────── */}
      <section className="section bg-white" id="about-john">
        <div className="container-max">
          <div className="max-w-4xl mx-auto">
            {/* Section label */}
            <div className="mb-6">
              <p className="text-sm font-semibold tracking-widest uppercase text-accent mb-2">Meet the Founder</p>
              <h2 className="text-3xl font-bold text-text">About John Menke</h2>
            </div>

            <div className="flex flex-col md:flex-row gap-10 items-start">
              {/* Photo */}
              <div className="shrink-0">
                {/* John Menke — founder of moval.living */}
                {/* Source: https://movalliving.s3.us-west-1.amazonaws.com/JohnMenke.png */}
                <Image
                  src="https://movalliving.s3.us-west-1.amazonaws.com/JohnMenke.png"
                  alt="John Menke, Founder of moval.living"
                  width={192}
                  height={192}
                  className="w-48 h-48 rounded-2xl object-cover shadow-md"
                />
              </div>

              {/* Bio */}
              <div className="flex-1 space-y-4">
                <p className="text-text leading-relaxed">
                  In June 1990, my wife was pregnant with our first son and we moved to Moreno Valley.
                  We've been here ever since — raising our family, building our lives, and watching this
                  city become home in a way we never expected.
                </p>
                <p className="text-text leading-relaxed">
                  I'm a licensed California Real Estate Broker (DRE #01959317, NMLS #2333681) with
                  eXP of California Realty, Inc. Before real estate, I spent nearly 30 years in municipal
                  government and served in the U.S. Army — giving me a deep, long-standing connection
                  to this community and the people who call it home.
                </p>
                <p className="text-text leading-relaxed">
                  Moval.living started the way most good ideas do: out of frustration. I'd lived here
                  long enough to know which restaurants the locals loved, which contractors actually
                  showed up, and which agents actually cared about their clients — and I watched all
                  that knowledge stay trapped in neighborhoods and friendship circles. Great businesses
                  were invisible to anyone who didn't already know them.
                </p>
                <p className="text-text leading-relaxed">
                  So I built moval.living — not as a real estate site, but as a community directory.
                  A way to surface the people and places that make Moreno Valley worth living in.
                </p>
                <p className="text-text leading-relaxed">
                  Active in the Moreno Valley community through Chamber of Commerce events and various
                  local volunteer initiatives. While I'd love for you to choose me as your agent — I'd
                  rather help you find the right person for <em>your</em> situation. That's why I
                  created the Best Of Moreno Valley program: to surface the agents, restaurants, and
                  businesses I'd trust enough to recommend to my own family.
                </p>

                {/* Credentials */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                    DRE #01959317
                  </span>
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                    NMLS #2333681
                  </span>
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                    eXP of California Realty, Inc.
                  </span>
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                    U.S. Army Veteran
                  </span>
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                    Moreno Valley Resident Since 1990
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-secondary section text-white">
        <div className="container-max text-center">
          <h2 className="mb-4 text-3xl font-bold">Thinking of Buying or Selling in Moreno Valley?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/70">
            With years of local market expertise and a deep understanding of the Moreno Valley
            community, John Menke is your trusted real estate broker for the Moreno Valley area.
            Whether you&apos;re a first-time buyer, upgrading, or investing, he&apos;s here to guide you.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a href="/homes" className="btn-accent inline-flex items-center gap-2">
              Browse Active Listings <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/about-moreno-valley#contact" className="btn-outline border-white/30 text-white hover:bg-white/10 hover:text-white">
              Talk to John
            </a>
          </div>
        </div>
      </section>

      <FaqSection
        title="Frequently Asked Questions"
        subtitle="Common questions about Moreno Valley, real estate, and moval.living."
        faqs={[
          {
            question: 'What cities does moval.living cover?',
            answer:
              'moval.living focuses on Moreno Valley, California, and the surrounding Inland Empire region. We feature local businesses serving Moreno Valley, Riverside, Perris, Hemet, San Jacinto, and neighboring communities.',
          },
          {
            question: 'How do I list my business on moval.living?',
            answer:
              'Click "Submit a Business" at the top of the page, fill in your business details, and our team will review it within 1–2 business days. Featured listings get priority review and additional visibility.',
          },
          {
            question: 'What is the difference between a Free and Featured listing?',
            answer:
              'Free listings include your business name, address, phone, website, and description. Featured listings ($29/month) add a cover image, photo gallery, Google Reviews integration, priority placement, and highlighted placement in category pages.',
          },
          {
            question: 'Can I update my business information after submitting?',
            answer:
              'Yes. Once your listing is live, you can claim it by clicking "Claim This Listing" and gain access to update your business details, hours, photos, and respond to reviews.',
          },
          {
            question: 'How does the Best Of Moreno Valley program work?',
            answer:
              'Our editors curate the Best Of Moreno Valley categories by researching and evaluating local businesses across categories like food, services, and professional services. Winners are featured prominently on the site and receive a Best Of badge on their listing.',
          },
          {
            question: 'How do I contact moval.living support?',
            answer:
              'You can reach us by visiting the Contact page or emailing support@moval.living. We typically respond within 1 business day.',
          },
        ]}
      />
    </div>
  )
}
