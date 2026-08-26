'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Check,
  ArrowRight,
  Calendar,
  Phone,
  Send,
  CheckCircle,
  Globe,
  Sparkles,
  Zap,
  Search,
  Star,
  MessageSquare,
  Shield,
  Clock,
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BOOKING_URL = 'https://api.headsuphq.com/widget/booking/muZA0UoHRwtxiYTTlKHv'
const PHONE_NUMBER = '+1 888-887-5950'
const PHONE_HREF = 'tel:+18888875950'

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
    accent: 'border-teal-500/30',
    glow: 'from-teal-500/10 to-transparent',
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
    accent: 'border-amber-400/40',
    glow: 'from-amber-400/15 to-transparent',
  },
]

const process = [
  {
    step: '01',
    title: 'Demo Call',
    time: '20 mins',
    body: "It's a sales call, we just didn't want to scare you. We'll answer your questions, show live client accounts, and map out what your site needs.",
  },
  {
    step: '02',
    title: 'We Build',
    time: '7–10 days',
    body: 'You fill out a short onboarding form. Once we have your details, we design, write, and build your new site — copy, photos, and all.',
  },
  {
    step: '03',
    title: 'Launch Call',
    time: '25 mins',
    body: "We walk you through the finished site, show you how everything works, and flip the switch. Usually that means pressing about two buttons.",
  },
]

const faqs = [
  {
    question: 'Is there a contract or minimum commitment?',
    answer:
      'No. All plans are month-to-month. Cancel anytime from your billing portal — no fees, no questions asked.',
  },
  {
    question: 'How does billing work?',
    answer:
      'All billing is handled through Stripe. Your payment info is secure and you can manage everything from your billing portal at any time.',
  },
  {
    question: 'What is the $497 setup & onboarding fee?',
    answer:
      "It's currently waived for all new clients. Normally a $497 one-time charge for account setup, configuration, and onboarding. This is a limited-time offer.",
  },
  {
    question: "What's the difference between Foundation and Premium?",
    answer:
      'Foundation is a standalone website with leads forwarded to your inbox. Premium includes everything — website, missed call text back, review funnel, one-click marketing campaigns, and local SEO — all for $297/mo.',
  },
  {
    question: 'Can I upgrade or downgrade at any time?',
    answer:
      "Yes. You can upgrade anytime and we'll prorate the difference automatically. Downgrades take effect at the start of your next billing cycle.",
  },
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
      <div className="text-center py-10 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-500/10 text-teal-400 mb-5">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h4 className="text-xl font-bold text-white mb-2">Message Sent</h4>
        <p className="text-slate-400 max-w-sm mx-auto">
          We received your details and will reach out within one business day.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Your name *"
          required
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-colors"
        />
        <input
          type="text"
          name="business"
          value={form.business}
          onChange={handleChange}
          placeholder="Business name"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-colors"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Email address *"
          required
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-colors"
        />
        <input
          type="tel"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="Phone number"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-colors"
        />
      </div>
      <textarea
        name="message"
        value={form.message}
        onChange={handleChange}
        placeholder="Tell us about your business and what you need..."
        rows={4}
        required
        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-colors resize-none"
      />
      {error && <p className="text-rose-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold px-6 py-3.5 transition-colors disabled:opacity-60"
      >
        {submitting ? 'Sending...' : 'Send Message'}
        <Send className="w-4 h-4" />
      </button>
      <p className="text-xs text-slate-500 text-center">
        We typically reply within one business day.
      </p>
    </form>
  )
}

function ContactSection() {
  return (
    <section id="contact" className="scroll-mt-24">
      <div className="container-max">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-0 rounded-3xl overflow-hidden border border-white/10 bg-[#111A1E]">
            {/* Form side */}
            <div className="p-8 sm:p-10 lg:p-12">
              <div className="mb-8">
                <span className="inline-flex items-center gap-2 text-teal-400 text-sm font-semibold uppercase tracking-wider mb-3">
                  <MessageSquare className="w-4 h-4" />
                  Send a Message
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  Tell us what you&apos;re building
                </h2>
                <p className="text-slate-400">
                  Fill this out and we&apos;ll get back to you with next steps — usually the same day.
                </p>
              </div>
              <LeadForm />
            </div>

            {/* Options side */}
            <div className="relative p-8 sm:p-10 lg:p-12 bg-gradient-to-br from-teal-900/20 via-[#111A1E] to-[#0B1215] border-t lg:border-t-0 lg:border-l border-white/10">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Sparkles className="w-32 h-32 text-teal-400" />
              </div>

              <div className="relative">
                <span className="inline-flex items-center gap-2 text-amber-400 text-sm font-semibold uppercase tracking-wider mb-3">
                  <Clock className="w-4 h-4" />
                  Prefer to Talk?
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                  Book a free call or ring us
                </h2>
                <p className="text-slate-400 mb-8">
                  No pressure, no pitch deck. We&apos;ll answer your questions and show you what a real build looks like.
                </p>

                <div className="space-y-4">
                  <a
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 hover:border-teal-500/30 transition-all"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">Book a call</div>
                      <div className="text-sm text-slate-400 truncate">{BOOKING_URL.replace('https://', '')}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-teal-400 transition-colors" />
                  </a>

                  <a
                    href={PHONE_HREF}
                    className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 hover:border-amber-400/30 transition-all"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 group-hover:scale-110 transition-transform">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">Call us</div>
                      <div className="text-sm text-slate-400">{PHONE_NUMBER}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                  </a>
                </div>

                <div className="mt-8 rounded-2xl bg-white/5 border border-white/10 p-5">
                  <p className="text-sm text-slate-400">
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

function FloatingBrowser() {
  return (
    <div className="relative mx-auto max-w-5xl perspective-1000">
      <div className="relative rounded-2xl border border-white/10 bg-[#0f1619] shadow-2xl shadow-teal-900/20 overflow-hidden transform md:rotate-x-2 md:rotate-y-1 transition-transform duration-700 hover:rotate-0">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#151e23] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="ml-4 flex-1 rounded-lg bg-black/30 px-3 py-1.5 text-xs text-slate-500 truncate">
            www.moval.living
          </div>
        </div>
        {/* Screenshot of moval.living homepage */}
        <div className="relative aspect-[16/10] w-full bg-[#f0efeb]">
          <Image
            src="/og-default.jpg"
            alt="MoVal Living homepage preview"
            fill
            className="object-cover object-top"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1215] via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 text-xs font-medium text-white">
              <Globe className="w-3.5 h-3.5" />
              Live site — moval.living
            </div>
          </div>
        </div>
      </div>

      {/* Floating stats */}
      <div className="absolute -bottom-6 left-6 right-6 md:left-auto md:right-8 md:-bottom-8 md:w-72">
        <div className="rounded-2xl border border-white/10 bg-[#111A1E]/95 backdrop-blur-md p-5 shadow-xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-white">7–10</div>
              <div className="text-xs text-slate-400">days to launch</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">10–20</div>
              <div className="text-xs text-slate-400">pages included</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WebDesignClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="bg-[#0B1215] text-slate-200">
      {/* Hero */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
        {/* Background gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-teal-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[800px] h-[500px] bg-amber-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="container-max relative">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-4 py-1.5 text-sm font-medium text-teal-300 mb-6">
              <Sparkles className="w-4 h-4" />
              Setup & onboarding (a $497 value) on us — limited time
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight mb-6">
              A website that works as hard as your business does
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
              Custom websites for local businesses, built and maintained by the team behind moval.living. No contracts. Cancel anytime.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold px-8 py-4 transition-colors"
              >
                <Calendar className="w-5 h-5" />
                Book a free call
              </a>
              <Link
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-4 transition-colors"
              >
                See pricing
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          <FloatingBrowser />
        </div>
      </section>

      {/* Social proof / trust */}
      <section className="border-y border-white/10 bg-[#0f1619]/50">
        <div className="container-max py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '$497', label: 'setup fee waived' },
              { value: '7–10', label: 'days to launch' },
              { value: '0', label: 'long-term contracts' },
              { value: '∞', label: 'support included' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-slate-500 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-20 md:py-28">
        <div className="container-max">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="inline-flex items-center gap-2 text-teal-400 text-sm font-semibold uppercase tracking-wider mb-3">
              <Zap className="w-4 h-4" />
              What you get
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5">
              Not just a website. A lead machine.
            </h2>
            <p className="text-lg text-slate-400">
              Every site is designed around the things that actually drive revenue for local businesses.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: Globe,
                title: 'Custom professional design',
                body: "No templates that look like your competitor's. Every layout, color, and type choice is built around your brand.",
              },
              {
                icon: Phone,
                title: 'Missed Call Text Back',
                body: 'When you miss a call, the system texts the caller instantly so you stop losing leads to voicemail.',
              },
              {
                icon: Star,
                title: '5-Star Review Funnel',
                body: 'Automated review requests that route happy customers to Google and give you a chance to fix issues privately.',
              },
              {
                icon: Zap,
                title: 'One-click campaigns',
                body: 'Send emails, texts, and promotions to your leads and customers without writing copy from scratch.',
              },
              {
                icon: Search,
                title: 'Local SEO',
                body: 'Technical SEO, fast load times, and schema markup so your business shows up when locals search.',
              },
              {
                icon: Shield,
                title: 'Hosting & maintenance',
                body: 'Security updates, backups, uptime monitoring, and edits handled by us — not another todo on your list.',
              },
            ].map(card => (
              <div
                key={card.title}
                className="group rounded-2xl border border-white/10 bg-[#111A1E] p-7 hover:border-teal-500/30 hover:bg-[#131d22] transition-colors"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform">
                  <card.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{card.title}</h3>
                <p className="text-slate-400 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-24 py-20 md:py-28 bg-[#0f1619]">
        <div className="container-max">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="inline-flex items-center gap-2 text-amber-400 text-sm font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-4 h-4" />
              Simple pricing
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5">
              One monthly fee. Everything included.
            </h2>
            <p className="text-lg text-slate-400">
              No setup fee right now. No contracts. Just a website and marketing system that runs itself.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {tiers.map((tier, i) => (
              <div
                key={tier.id}
                className={cn(
                  'relative rounded-3xl border bg-[#111A1E] p-8 sm:p-10 overflow-hidden',
                  tier.accent
                )}
              >
                <div className={cn('absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br rounded-full blur-3xl opacity-40', tier.glow)} />
                {tier.badge && (
                  <div className="absolute top-6 right-6 rounded-full bg-amber-400/10 border border-amber-400/20 px-3 py-1 text-xs font-bold text-amber-300 uppercase tracking-wider">
                    {tier.badge}
                  </div>
                )}
                <div className="relative">
                  <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                  <p className="text-slate-400 mb-6 min-h-[3rem]">{tier.description}</p>
                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-5xl sm:text-6xl font-bold text-white">{tier.price}</span>
                    <span className="text-slate-500 font-medium">{tier.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map(feature => (
                      <li key={feature} className="flex items-start gap-3 text-slate-300">
                        <Check className={cn('w-5 h-5 flex-shrink-0 mt-0.5', i === 1 ? 'text-amber-400' : 'text-teal-400')} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'w-full inline-flex items-center justify-center gap-2 rounded-xl font-semibold px-6 py-4 transition-colors',
                      i === 1
                        ? 'bg-amber-500 hover:bg-amber-400 text-amber-950'
                        : 'bg-teal-600 hover:bg-teal-500 text-white'
                    )}
                  >
                    {tier.cta}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-500 mt-10 text-sm">
            Setup & onboarding (a $497 value) is currently waived for new clients.
          </p>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 md:py-28">
        <div className="container-max">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="inline-flex items-center gap-2 text-teal-400 text-sm font-semibold uppercase tracking-wider mb-3">
              <Clock className="w-4 h-4" />
              How it works
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5">
              From first call to live site in under two weeks
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {process.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="text-6xl font-bold text-white/5 mb-4">{step.step}</div>
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="text-xl font-bold text-white">{step.title}</h3>
                  <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs text-slate-400">
                    {step.time}
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">{step.body}</p>
                {i < process.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-white/10 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28 bg-[#0f1619]">
        <div className="container-max">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 text-teal-400 text-sm font-semibold uppercase tracking-wider mb-3">
                <MessageSquare className="w-4 h-4" />
                Common questions
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Questions? Answers.</h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-2xl border border-white/10 bg-[#111A1E] overflow-hidden transition-colors',
                    openFaq === i && 'border-teal-500/30'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 p-6 text-left"
                  >
                    <span className="font-semibold text-white">{faq.question}</span>
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-400 transition-transform',
                        openFaq === i && 'rotate-180 text-teal-400'
                      )}
                    >
                      <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="transition-colors">
                        <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-6 text-slate-400 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <ContactSection />

      {/* Final CTA */}
      <section className="py-20 md:py-28">
        <div className="container-max">
          <div className="max-w-4xl mx-auto text-center rounded-3xl border border-white/10 bg-gradient-to-br from-teal-900/20 via-[#111A1E] to-[#0B1215] p-10 sm:p-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5">
              Ready for a website that sells while you sleep?
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
              Book a free 20-minute demo call. We'll show you real sites, real results, and exactly what your build would look like.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold px-8 py-4 transition-colors"
              >
                <Calendar className="w-5 h-5" />
                Book a free call
              </a>
              <a
                href={PHONE_HREF}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-4 transition-colors"
              >
                <Phone className="w-5 h-5" />
                {PHONE_NUMBER}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
