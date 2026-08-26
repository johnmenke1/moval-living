'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Check,
  ArrowRight,
  Calendar,
  Phone,
  Send,
  CheckCircle,
  Globe,
  Sparkles,
  MessageSquare,
  Clock,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BOOKING_URL = 'https://api.headsuphq.com/widget/booking/muZA0UoHRwtxiYTTlKHv'
const PHONE_NUMBER = '+1 888-887-5950'
const PHONE_HREF = 'tel:+18888875950'

const CARBON = '#000000'
const SHALE = '#101010'
const WHITE = '#ffffff'
const RED = '#ff2936'

const tiers = [
  {
    id: 'foundation',
    name: 'Foundation',
    price: '$97',
    period: '/mo',
    badge: null,
    description: 'Your custom website, built and maintained. Leads go straight to your inbox.',
    features: [
      'Custom professional website',
      '10–20 pages',
      'Hosting & security updates',
      'Leads forwarded to your inbox',
      'Mobile-friendly design',
      '48-hour email support',
    ],
    cta: 'Request a Quote',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$297',
    period: '/mo',
    badge: 'Best Value',
    description:
      'Everything included — website, missed call text back, 5-star review funnel, one-click marketing campaigns, and local SEO.',
    features: [
      'Custom professional website (10–20 pages)',
      'Missed Call Text Back',
      '5-Star Magic Review Funnel',
      'One-Click Marketing Campaigns',
      'On-site SEO',
      'Automated lead follow-up',
      'Leads forwarded to your inbox',
      'Hosting & security updates',
      'Mobile-friendly design',
      'Priority email support',
    ],
    cta: 'Book a Free Call',
  },
]

const process = [
  { step: '01', title: 'Demo Call', time: '20 mins', body: "It's a sales call, we just didn't want to scare you. We'll answer your questions, show live client accounts, and map out what your site needs." },
  { step: '02', title: 'We Build', time: '7–10 days', body: 'You fill out a short onboarding form. Once we have your details, we design, write, and build your new site — copy, photos, and all.' },
  { step: '03', title: 'Launch Call', time: '25 mins', body: "We walk you through the finished site, show you how everything works, and flip the switch. Usually that means pressing two buttons." },
]

const faqs = [
  { question: 'Is there a contract or minimum commitment?', answer: 'No. All plans are month-to-month. Cancel anytime from your billing portal — no fees, no questions asked.' },
  { question: 'How does billing work?', answer: 'All billing is handled through Stripe. Your payment info is secure and you can manage everything from your billing portal at any time.' },
  { question: 'What is the $497 setup & onboarding fee?', answer: "It's currently waived for all new clients. Normally a $497 one-time charge for account setup, configuration, and onboarding. This is a limited-time offer." },
  { question: "What's the difference between Foundation and Premium?", answer: 'Foundation is a standalone website with leads forwarded to your inbox. Premium includes everything — website, missed call text back, review funnel, one-click marketing campaigns, and local SEO — all for $297/mo.' },
  { question: 'Can I upgrade or downgrade at any time?', answer: "Yes. You can upgrade anytime and we'll prorate the difference automatically. Downgrades take effect at the start of your next billing cycle." },
]

const reel = [
  { name: 'Mendez Auto Repair', cat: 'Automotive' },
  { name: 'Bella Vista Kitchen', cat: 'Restaurant' },
  { name: 'Valley Dental Care', cat: 'Healthcare' },
  { name: 'Rancho Belago Realty', cat: 'Real Estate' },
  { name: 'MoVal Coffee Roasters', cat: 'Café' },
  { name: 'Desert Bloom Landscaping', cat: 'Landscaping' },
  { name: 'Inland Empire HVAC', cat: 'Contractor' },
]

function LeadForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', business: '' })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in your name, email, and message.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'moval.living-web-design',
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          message: form.message.trim(),
          business: form.business.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Submission failed')
      setSuccess(true)
      setForm({ name: '', email: '', phone: '', message: '', business: '' })
    } catch {
      setError('Something went wrong. Please try calling or booking a call instead.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-12 px-4 border border-white/10 bg-[#101010]">
        <div className="inline-flex items-center justify-center w-14 h-14 border border-white/10 text-white mb-5">
          <CheckCircle className="w-7 h-7" />
        </div>
        <h4 className="text-xl font-bold text-white mb-2 tracking-tight">Message Sent</h4>
        <p className="text-white/60 max-w-sm mx-auto">We received your details and will reach out within one business day.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Your name *" required className="w-full bg-black border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-colors" />
        <input type="text" name="business" value={form.business} onChange={handleChange} placeholder="Business name" className="w-full bg-black border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-colors" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email address *" required className="w-full bg-black border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-colors" />
        <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="Phone number" className="w-full bg-black border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-colors" />
      </div>
      <textarea name="message" value={form.message} onChange={handleChange} placeholder="Tell us about your business and what you need..." rows={4} required className="w-full bg-black border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-colors resize-none" />
      {error && <p className="text-[#ff2936] text-sm">{error}</p>}
      <button type="submit" disabled={submitting} className="w-full inline-flex items-center justify-center gap-2 bg-white text-black hover:bg-white/90 font-semibold px-6 py-4 transition-colors disabled:opacity-60">
        {submitting ? 'Sending...' : 'Send Message'}
        <Send className="w-4 h-4" />
      </button>
      <p className="text-xs text-white/40 text-center">We typically reply within one business day.</p>
    </form>
  )
}

function Ticker({ items, speed = 30 }: { items: { name: string; cat: string }[]; speed?: number }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track || paused) return
    let raf = 0
    let x = 0
    const step = () => {
      x += 0.4
      if (track) {
        const first = track.firstElementChild as HTMLElement
        if (first && x >= first.offsetWidth + 16) {
          x = 0
          track.appendChild(first)
        }
        track.style.transform = `translateX(-${x}px)`
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [paused])

  return (
    <div className="overflow-hidden border-t border-white/10 bg-black" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div ref={trackRef} className="flex whitespace-nowrap will-change-transform">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4 border-r border-white/10 min-w-max">
            <div className="w-2 h-2 bg-[#ff2936] rounded-full" />
            <span className="text-white text-sm font-medium tracking-tight">{item.name}</span>
            <span className="text-white/40 text-xs uppercase tracking-widest">{item.cat}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DemoBrowser() {
  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="relative border border-white/10 bg-black overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#101010] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          </div>
          <div className="ml-4 flex-1 border border-white/10 bg-black px-3 py-1 text-xs text-white/40 truncate">acme-moval.com</div>
        </div>

        {/* Demo site content */}
        <div className="relative min-h-[360px] sm:min-h-[420px] p-6 sm:p-10 flex flex-col justify-between bg-black">
          {/* Nav */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="text-white font-bold tracking-tight text-sm sm:text-base">ACME <span className="text-[#ff2936]">.</span></div>
            <div className="hidden sm:flex items-center gap-6 text-xs text-white/60 uppercase tracking-widest">
              <span>Services</span>
              <span>Work</span>
              <span>About</span>
              <span className="text-white border border-white/20 px-3 py-1">Contact</span>
            </div>
            <Menu className="w-5 h-5 text-white/60 sm:hidden" />
          </div>

          {/* Hero of the demo site */}
          <div className="py-10 sm:py-14">
            <div className="max-w-2xl">
              <p className="text-[#ff2936] text-xs uppercase tracking-[0.2em] font-semibold mb-4">Moreno Valley</p>
              <h2 className="text-white text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[0.95] mb-6" style={{ fontFamily: "var(--font-fraunces), 'Times New Roman', serif" }}>
                Built for the <em className="not-italic text-white/80">locals</em>.
              </h2>
              <p className="text-white/60 text-sm sm:text-base max-w-md leading-relaxed mb-6">
                A website designed to turn every visitor into a lead — mobile-first, fast, and impossible to miss in local search.
              </p>
              <div className="inline-flex items-center gap-2 text-black bg-white px-5 py-2.5 text-sm font-semibold">
                Get a Quote <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Demo cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-white/10 pt-5">
            {[
              { label: 'Services', value: '12+' },
              { label: '5-Star Reviews', value: '4.9' },
              { label: 'Leads / Mo', value: '143' },
            ].map(stat => (
              <div key={stat.label} className="border border-white/10 p-3">
                <div className="text-white text-xl sm:text-2xl font-extralight tracking-tight">{stat.value}</div>
                <div className="text-white/40 text-[10px] uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating stats */}
      <div className="absolute -bottom-8 left-4 right-4 sm:left-auto sm:right-6 sm:-bottom-10 sm:w-80">
        <div className="border border-white/10 bg-[#101010] p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-extralight text-white">7–10</div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">days to launch</div>
            </div>
            <div>
              <div className="text-2xl font-extralight text-white">10–20</div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">pages included</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactSection() {
  return (
    <section id="contact" className="scroll-mt-24 bg-[#101010] border-t border-white/10">
      <div className="container-max py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-0 border border-white/10 bg-black">
            <div className="p-8 sm:p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-white/10">
              <div className="mb-8">
                <span className="inline-flex items-center gap-2 text-white/50 text-xs font-semibold uppercase tracking-[0.2em] mb-3">
                  <MessageSquare className="w-4 h-4" />
                  Send a Message
                </span>
                <h2 className="text-3xl sm:text-4xl font-extralight text-white tracking-tight mb-3">Tell us what you&apos;re building</h2>
                <p className="text-white/50">Fill this out and we&apos;ll get back to you — usually the same day.</p>
              </div>
              <LeadForm />
            </div>

            <div className="relative p-8 sm:p-10 lg:p-12 overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-10">
                <Sparkles className="w-32 h-32 text-white" />
              </div>
              <div className="relative">
                <span className="inline-flex items-center gap-2 text-[#ff2936] text-xs font-semibold uppercase tracking-[0.2em] mb-3">
                  <Clock className="w-4 h-4" />
                  Prefer to Talk?
                </span>
                <h2 className="text-3xl sm:text-4xl font-extralight text-white tracking-tight mb-3">Book a call or ring us</h2>
                <p className="text-white/50 mb-10">No pressure, no pitch deck. We&apos;ll answer your questions and show you a real build.</p>

                <div className="space-y-4">
                  <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 border border-white/10 bg-black p-5 hover:border-white/30 transition-colors">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/10 text-white group-hover:scale-110 transition-transform">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">Book a call</div>
                      <div className="text-sm text-white/40 truncate">{BOOKING_URL.replace('https://', '')}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
                  </a>

                  <a href={PHONE_HREF} className="group flex items-center gap-4 border border-white/10 bg-black p-5 hover:border-white/30 transition-colors">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/10 text-white group-hover:scale-110 transition-transform">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">Call us</div>
                      <div className="text-sm text-white/40">{PHONE_NUMBER}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
                  </a>
                </div>

                <div className="mt-8 border border-white/10 p-5">
                  <p className="text-sm text-white/50">
                    <span className="text-white font-medium">Typical response time:</span> under 2 hours during business hours. After hours? Leave a message — we check them first thing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function WebDesignClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="bg-black text-white">
      {/* Top bar */}
      <div className="border-b border-white/10">
        <div className="container-max flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 text-white font-semibold tracking-tight">
            <Globe className="w-4 h-4" />
            MoVal Living
          </Link>
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors">
            + Book a Call
          </a>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16 pb-28 md:pt-24 md:pb-36">
        <div className="container-max relative">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 border border-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.15em] text-white/60 mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              Setup & onboarding ($497 value) on us — limited time
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extralight text-white tracking-tight leading-[0.95] mb-8" style={{ fontFamily: "var(--font-fraunces), 'Times New Roman', serif" }}>
              Websites that <em className="not-italic text-white/70">sell</em> while you sleep
            </h1>
            <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10">
              Custom websites for local businesses, built and maintained by the team behind moval.living. No contracts. Cancel anytime.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#ff2936] hover:bg-[#e0202d] text-white font-semibold px-8 py-4 transition-colors">
                <Calendar className="w-5 h-5" />
                Book a free call
              </a>
              <Link href="#pricing" className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white font-semibold px-8 py-4 transition-colors">
                See pricing <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          <DemoBrowser />
        </div>
      </section>

      {/* Project reel ticker */}
      <Ticker items={reel} />

      {/* What you get */}
      <section className="border-t border-white/10">
        <div className="container-max py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="inline-flex items-center gap-2 text-white/50 text-xs font-semibold uppercase tracking-[0.2em] mb-3">+ What you get</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight text-white tracking-tight mb-5">Not just a site. A lead machine.</h2>
            <p className="text-lg text-white/50">Every build is designed around the things that actually drive revenue for local businesses.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 max-w-6xl mx-auto">
            {[
              { icon: Globe, title: 'Custom professional design', body: "No templates that look like your competitor's. Every layout, color, and type choice is built around your brand." },
              { icon: Phone, title: 'Missed Call Text Back', body: 'When you miss a call, the system texts the caller instantly so you stop losing leads to voicemail.' },
              { icon: Sparkles, title: '5-Star Review Funnel', body: 'Automated review requests that route happy customers to Google and give you a chance to fix issues privately.' },
              { icon: ArrowRight, title: 'One-click campaigns', body: 'Send emails, texts, and promotions to your leads and customers without writing copy from scratch.' },
              { icon: Globe, title: 'Local SEO', body: 'Technical SEO, fast load times, and schema markup so your business shows up when locals search.' },
              { icon: Check, title: 'Hosting & maintenance', body: 'Security updates, backups, uptime monitoring, and edits handled by us — not another todo on your list.' },
            ].map(card => (
              <div key={card.title} className="bg-black p-8 sm:p-10 hover:bg-[#101010] transition-colors group">
                <div className="mb-5 inline-flex h-10 w-10 items-center justify-center border border-white/10 text-white group-hover:scale-110 transition-transform">
                  <card.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 tracking-tight">{card.title}</h3>
                <p className="text-white/50 leading-relaxed text-sm">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-24 border-t border-white/10 bg-[#101010]">
        <div className="container-max py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="inline-flex items-center gap-2 text-[#ff2936] text-xs font-semibold uppercase tracking-[0.2em] mb-3">+ Simple pricing</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight text-white tracking-tight mb-5">One monthly fee. Everything included.</h2>
            <p className="text-lg text-white/50">No setup fee right now. No contracts. Just a website and marketing system that runs itself.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-white/10 max-w-5xl mx-auto">
            {tiers.map((tier, i) => (
              <div key={tier.id} className="relative bg-black p-8 sm:p-10">
                {tier.badge && <div className="absolute top-6 right-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff2936] border border-[#ff2936]/30 px-2 py-1">{tier.badge}</div>}
                <h3 className="text-2xl font-semibold text-white mb-2 tracking-tight">{tier.name}</h3>
                <p className="text-white/50 mb-6 min-h-[3rem] text-sm">{tier.description}</p>
                <div className="flex items-baseline gap-1 mb-8 border-b border-white/10 pb-6">
                  <span className="text-5xl sm:text-6xl font-extralight text-white tracking-tight">{tier.price}</span>
                  <span className="text-white/40 font-medium">{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex items-start gap-3 text-white/70 text-sm">
                      <Check className={cn('w-4 h-4 flex-shrink-0 mt-0.5', i === 1 ? 'text-[#ff2936]' : 'text-white')} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className={cn('w-full inline-flex items-center justify-center gap-2 font-semibold px-6 py-4 transition-colors', i === 1 ? 'bg-[#ff2936] hover:bg-[#e0202d] text-white' : 'bg-white hover:bg-white/90 text-black')}>
                  {tier.cta} <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>

          <p className="text-center text-white/40 mt-10 text-sm">Setup & onboarding (a $497 value) is currently waived for new clients.</p>
        </div>
      </section>

      {/* Process */}
      <section className="border-t border-white/10">
        <div className="container-max py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="inline-flex items-center gap-2 text-white/50 text-xs font-semibold uppercase tracking-[0.2em] mb-3">+ How it works</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight text-white tracking-tight mb-5">From first call to live site in under two weeks</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-white/10 max-w-6xl mx-auto">
            {process.map((step, i) => (
              <div key={step.title} className="bg-black p-8 sm:p-10 relative">
                <div className="text-6xl font-extralight text-white/5 mb-4">{step.step}</div>
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-white tracking-tight">{step.title}</h3>
                  <span className="text-[10px] uppercase tracking-widest text-white/40 border border-white/10 px-2 py-0.5">{step.time}</span>
                </div>
                <p className="text-white/50 leading-relaxed text-sm">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-white/10 bg-[#101010]">
        <div className="container-max py-20 md:py-28">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 text-white/50 text-xs font-semibold uppercase tracking-[0.2em] mb-3">+ Common questions</span>
              <h2 className="text-3xl sm:text-4xl font-extralight text-white tracking-tight">Questions? Answers.</h2>
            </div>

            <div className="space-y-px bg-white/10">
              {faqs.map((faq, i) => (
                <div key={i} className={cn('bg-black overflow-hidden transition-colors', openFaq === i && 'bg-[#101010]')}>
                  <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 p-6 text-left">
                    <span className="font-semibold text-white tracking-tight">{faq.question}</span>
                    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center border border-white/10 text-white/40 transition-transform', openFaq === i && 'rotate-180 text-white')}>{openFaq === i ? <X className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
                  </button>
                  {openFaq === i && <div className="px-6 pb-6 text-white/50 leading-relaxed text-sm">{faq.answer}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <ContactSection />

      {/* Final CTA */}
      <section className="border-t border-white/10">
        <div className="container-max py-20 md:py-28">
          <div className="max-w-4xl mx-auto text-center border border-white/10 bg-black p-10 sm:p-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight text-white tracking-tight mb-5">Ready for a website that sells while you sleep?</h2>
            <p className="text-lg text-white/50 mb-8 max-w-2xl mx-auto">Book a free 20-minute demo call. We&apos;ll show you real sites, real results, and exactly what your build would look like.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#ff2936] hover:bg-[#e0202d] text-white font-semibold px-8 py-4 transition-colors">
                <Calendar className="w-5 h-5" /> Book a free call
              </a>
              <a href={PHONE_HREF} className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white font-semibold px-8 py-4 transition-colors">
                <Phone className="w-5 h-5" /> {PHONE_NUMBER}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
