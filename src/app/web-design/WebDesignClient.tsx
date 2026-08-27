'use client'

import { useState, useRef } from 'react'
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
  Play,
  Pause,
  Zap,
  TrendingUp,
  MousePointer2,
  Star,
  Shield,
} from 'lucide-react'
import { clsx } from 'clsx'
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion'
import {
  Reveal,
  StaggerContainer,
  StaggerItem,
  AnimatedNumber,
  MagneticButton,
  Marquee,
  AmbientOrbs,
  ShimmerText,
  ParallaxSection,
  FloatingCard,
  PulseRing,
  SplitReveal,
  springTransition,
} from './Motion'

const CATEGORY_TICKER = [
  'Restaurants',
  'Contractors',
  'Healthcare',
  'Auto Repair',
  'Real Estate',
  'Retail',
  'Salons & Spas',
  'Home Services',
  'Legal',
  'Fitness',
  'Pet Services',
  'Professional Services',
]

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
  },
]

const process = [
  {
    step: '01',
    title: 'Demo Call',
    time: '20 mins',
    body: "It's a sales call, we just didn't want to scare you. But seriously — we'll answer all your questions, show you live client accounts & results.",
  },
  {
    step: '02',
    title: 'We Build',
    time: '24–48 hours',
    body: "Fill out a basic onboarding form with your business details. After we have the correct information, we'll get to work building your new system.",
  },
  {
    step: '03',
    title: 'Launch Call',
    time: '25 mins',
    body: "We'll walk you through your new website & marketing system, answer any questions, and show you how everything works… And by everything, we mean pressing two buttons.",
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
      'All billing is handled through Stripe — your payment info is secure and you can manage everything from your billing portal at any time.',
  },
  {
    question: 'What is the $497 setup & onboarding fee?',
    answer:
      "It's currently waived for all new clients — normally a $497 one-time charge for account setup, configuration, and onboarding. This is a limited-time offer.",
  },
  {
    question: "What's the difference between Foundation and Premium?",
    answer:
      'Foundation is a standalone website with leads forwarded to your inbox. Premium includes everything — website, missed call text back, review funnel, one-click marketing campaigns, and local SEO — all for $297/mo.',
  },
  {
    question: 'Can I upgrade or downgrade at any time?',
    answer:
      "Yes. You can upgrade anytime and we'll prorate the difference automatically. Downgrades take effect at the start of your next billing cycle — you keep your current plan until then.",
  },
]

const features = [
  { icon: Globe, title: 'Custom professional design', body: "No templates that look like your competitor's. Every layout, color, and type choice is built around your brand.", accent: 'primary' },
  { icon: Phone, title: 'Missed Call Text Back', body: 'When you miss a call, the system texts the caller instantly so you stop losing leads to voicemail.', accent: 'coral' },
  { icon: Star, title: '5-Star Review Funnel', body: 'Automated review requests that route happy customers to Google and give you a chance to fix issues privately.', accent: 'gold' },
  { icon: Zap, title: 'One-click campaigns', body: 'Send emails, texts, and promotions to your leads and customers without writing copy from scratch.', accent: 'coral' },
  { icon: TrendingUp, title: 'Local SEO', body: 'Technical SEO, fast load times, and schema markup so your business shows up when locals search.', accent: 'primary' },
  { icon: Shield, title: 'Hosting & maintenance', body: 'Security updates, backups, uptime monitoring, and edits handled by us — not another todo on your list.', accent: 'gold' },
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
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#00a8a8]/10 text-[#00a8a8] mb-5">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h4 className="text-xl font-bold text-[#081820] mb-2">Message Sent</h4>
        <p className="text-[#5a6c72] max-w-sm mx-auto">We received your details and will reach out within one business day.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Your name *" required className="input" />
        <input type="text" name="business" value={form.business} onChange={handleChange} placeholder="Business name" className="input" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email address *" required className="input" />
        <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="Phone number" className="input" />
      </div>
      <textarea name="message" value={form.message} onChange={handleChange} placeholder="Tell us about your business and what you need..." rows={4} required className="input resize-none" />
      {error && <p className="text-error text-sm">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
        {submitting ? 'Sending...' : 'Send Message'}
        <Send className="w-4 h-4" />
      </button>
      <p className="text-xs text-[#5a6c72] text-center">We typically reply within 24 hours.</p>
    </form>
  )
}

function ContactSection() {
  return (
    <section id="contact" className="scroll-mt-24">
      <div className="container-max">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-0 rounded-3xl overflow-hidden border border-white/20 bg-gradient-to-br from-[#061f2e]/95 to-[#0b3a52]/95 backdrop-blur-xl shadow-2xl">
            <div className="p-8 sm:p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-white/10">
              <div className="mb-8">
                <span className="inline-flex items-center gap-2 text-[#00a8a8] text-sm font-semibold uppercase tracking-wider mb-3">
                  <MessageSquare className="w-4 h-4" />
                  Send a Message
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Tell us what you&apos;re building</h2>
                <p className="text-white/70">Fill this out and we&apos;ll get back to you with next steps — usually the same day.</p>
              </div>
              <LeadForm />
            </div>

            <div className="relative p-8 sm:p-10 lg:p-12 bg-gradient-to-br from-[#00a8a8]/10 via-[#061f2e]/50 to-[#0b3a52]/50">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Sparkles className="w-32 h-32 text-[#00a8a8]" />
              </div>
              <div className="relative">
                <span className="inline-flex items-center gap-2 text-[#ff7a66] text-sm font-semibold uppercase tracking-wider mb-3">
                  <Clock className="w-4 h-4" />
                  Prefer to Talk?
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Book a call or ring us</h2>
                <p className="text-white/70 mb-8">No pressure, no pitch deck. We&apos;ll answer your questions and show you what a real build looks like.</p>

                <div className="space-y-4">
                  <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 hover:border-[#00a8a8]/30 hover:shadow-lg transition-all">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#00a8a8]/10 text-[#00a8a8] group-hover:scale-110 transition-transform">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">Book a call</div>
                      <div className="text-sm text-white/50 truncate">{BOOKING_URL.replace('https://', '')}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-[#00a8a8] transition-colors" />
                  </a>

                  <a href={PHONE_HREF} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 hover:border-[#ff7a66]/30 hover:shadow-lg transition-all">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ff7a66]/10 text-[#ff7a66] group-hover:scale-110 transition-transform">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">Call us</div>
                      <div className="text-sm text-white/50">{PHONE_NUMBER}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-[#ff7a66] transition-colors" />
                  </a>
                </div>

                <div className="mt-8 rounded-2xl bg-white/5 border border-white/10 p-5">
                  <p className="text-sm text-white/60">
                    <span className="text-white font-medium">Typical response time:</span> under 24 hours. For urgent issues, call or text and we usually respond within a few hours.
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

function BeforeAfterBrowser() {
  const before = (
    <div className="relative w-full h-full min-h-[420px] sm:min-h-[520px] bg-slate-100 flex flex-col">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-slate-300 bg-slate-200 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-slate-400" />
          <span className="h-3 w-3 rounded-full bg-slate-400" />
          <span className="h-3 w-3 rounded-full bg-slate-400" />
        </div>
        <div className="ml-4 flex-1 rounded-lg bg-white px-3 py-1.5 text-xs text-slate-400 truncate flex items-center gap-2">
          <Globe className="w-3 h-3" /> acme-template-47.com
        </div>
      </div>
      {/* Sad template content */}
      <div className="flex-1 p-6 sm:p-10 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-slate-300 mb-6" />
        <div className="h-8 w-48 bg-slate-300 rounded mb-4" />
        <div className="h-4 w-64 bg-slate-200 rounded mb-8" />
        <div className="h-10 w-40 bg-slate-300 rounded-lg mb-10" />
        <div className="grid grid-cols-3 gap-4 w-full max-w-md">
          <div className="h-24 bg-slate-200 rounded-lg" />
          <div className="h-24 bg-slate-200 rounded-lg" />
          <div className="h-24 bg-slate-200 rounded-lg" />
        </div>
        <div className="mt-8 flex items-center gap-2 text-slate-400 text-sm">
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Loads in 4.2s</span>
          <span>•</span>
          <span>Mobile-broken</span>
          <span>•</span>
          <span>No leads</span>
        </div>
      </div>
    </div>
  )

  const after = (
    <div className="relative w-full h-full min-h-[420px] sm:min-h-[520px] bg-[#061f2e] flex flex-col overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm z-10">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <div className="ml-4 flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/60 truncate flex items-center gap-2">
          <Globe className="w-3 h-3" /> acme-moval.com
        </div>
      </div>
      {/* Gorgeous site content */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00a8a8]/20 via-transparent to-[#ff7a66]/10" />
        <div className="relative z-10 flex flex-col justify-between h-full p-6 sm:p-10">
          <div className="flex items-center justify-between">
            <div className="text-white font-bold tracking-tight text-sm sm:text-base">ACME <span className="text-[#ff7a66]">.</span></div>
            <div className="hidden sm:flex items-center gap-6 text-[10px] text-white/60 uppercase tracking-[0.15em]">
              <span>Services</span><span>Work</span><span>About</span>
              <span className="text-white border border-white/20 px-3 py-1 rounded">Contact</span>
            </div>
          </div>
          <div>
            <p className="text-[#ff7a66] text-xs uppercase tracking-[0.2em] font-semibold mb-4">Moreno Valley</p>
            <h3 className="text-white text-4xl sm:text-5xl md:text-6xl font-serif font-extralight tracking-tight leading-[0.95] mb-6">Built for the <em className="not-italic text-[#00a8a8]">locals</em>.</h3>
            <p className="text-white/80 text-sm sm:text-base max-w-md leading-relaxed mb-6">A website designed to turn every visitor into a lead — mobile-first, fast, and impossible to miss in local search.</p>
            <div className="inline-flex items-center gap-2 text-[#061f2e] bg-white px-5 py-2.5 text-sm font-semibold rounded-lg shadow-lg">Get a Quote <ArrowRight className="w-4 h-4" /></div>
          </div>
          <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/5 backdrop-blur-sm rounded-xl overflow-hidden">
            {[
              { label: 'Services', value: '12+' },
              { label: '5-Star Reviews', value: '4.9' },
              { label: 'Leads / Mo', value: '143' },
            ].map(stat => (
              <div key={stat.label} className="p-4 text-center border-r border-white/10 last:border-r-0">
                <div className="text-white text-xl sm:text-2xl font-extralight tracking-tight">{stat.value}</div>
                <div className="text-white/50 text-[10px] uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative mx-auto max-w-5xl">
      <FloatingCard intensity={4} className="rounded-2xl shadow-2xl ring-1 ring-white/10">
        <SplitReveal before={before} after={after} className="rounded-2xl" initialSplit={35} />
      </FloatingCard>

      {/* Floating metrics — on mobile they stack below the browser; on desktop they
          sit at three distinct corners/sides so they never overlap. */}
      <div className="mt-6 flex flex-col sm:mt-0 items-center gap-3 sm:block">
        <motion.div
          className="relative z-20 sm:absolute sm:-bottom-6 sm:left-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, ...springTransition }}
        >
          <div className="glass-light rounded-2xl p-4 shadow-xl flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#00a8a8] to-[#007a7f] text-white">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#081820]">More leads</div>
              <div className="text-[10px] uppercase tracking-wider text-[#5a6c72]">from traffic you already get</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="relative z-20 sm:absolute sm:-top-8 sm:-right-5"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, ...springTransition }}
        >
          <div className="glass-light rounded-2xl p-4 shadow-xl flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a66] to-[#e85d4a] text-white">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#081820]">0.9s</div>
              <div className="text-[10px] uppercase tracking-wider text-[#5a6c72]">load time</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="relative z-20 sm:absolute sm:top-1/2 sm:-right-5 sm:-translate-y-1/2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, ...springTransition }}
        >
          <div className="glass-light rounded-2xl p-4 shadow-xl flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#f3c46c] to-[#d4a84a] text-[#081820]">
              <MousePointer2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#081820]">24/7</div>
              <div className="text-[10px] uppercase tracking-wider text-[#5a6c72]">capturing leads</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function VideoDemoBrowser() {
  const [playing, setPlaying] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  const toggle = () => {
    if (!videoRef.current) return
    if (playing) videoRef.current.pause()
    else videoRef.current.play()
    setPlaying(!playing)
  }

  return (
    <div className="relative mx-auto max-w-5xl">
      <FloatingCard intensity={4} className="rounded-2xl shadow-2xl ring-1 ring-white/10">
        <div className="relative rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="ml-4 flex-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500 truncate flex items-center justify-between">
              <span className="flex items-center gap-2"><Globe className="w-3 h-3" /> acme-moval.com</span>
              <button type="button" onClick={toggle} className="ml-2 p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors" aria-label={playing ? 'Pause video' : 'Play video'}>
                {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div className="relative min-h-[360px] sm:min-h-[420px] flex flex-col justify-between overflow-hidden bg-black">
            <video ref={videoRef} src="/web-design-hero-demo.mp4" autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative flex items-center justify-between border-b border-white/10 px-6 sm:px-10 py-5">
              <div className="text-white font-bold tracking-tight text-sm sm:text-base">ACME <span className="text-[#ff7a66]">.</span></div>
              <div className="hidden sm:flex items-center gap-6 text-[10px] text-white/70 uppercase tracking-[0.15em]">
                <span>Services</span><span>Work</span><span>About</span>
                <span className="text-white border border-white/20 px-3 py-1 rounded">Contact</span>
              </div>
            </div>
            <div className="relative flex-1 flex items-center px-6 sm:px-10 py-10">
              <div className="max-w-xl">
                <p className="text-[#ff7a66] text-xs uppercase tracking-[0.2em] font-semibold mb-4">Moreno Valley</p>
                <h3 className="text-white text-4xl sm:text-5xl md:text-6xl font-serif font-extralight tracking-tight leading-[0.95] mb-6">Built for the <em className="not-italic text-[#00a8a8]">locals</em>.</h3>
                <p className="text-white/80 text-sm sm:text-base max-w-md leading-relaxed mb-6">A website designed to turn every visitor into a lead — mobile-first, fast, and impossible to miss in local search.</p>
                <div className="inline-flex items-center gap-2 text-[#061f2e] bg-white px-5 py-2.5 text-sm font-semibold rounded-lg shadow-lg">Get a Quote <ArrowRight className="w-4 h-4" /></div>
              </div>
            </div>
            <div className="relative grid grid-cols-3 gap-px border-t border-white/10 bg-black/40 backdrop-blur-sm">
              {[
                { label: 'Services', value: '12+' },
                { label: '5-Star Reviews', value: '4.9' },
                { label: 'Leads / Mo', value: '143' },
              ].map(stat => (
                <div key={stat.label} className="p-4 text-center border-r border-white/10 last:border-r-0">
                  <div className="text-white text-xl sm:text-2xl font-extralight tracking-tight">{stat.value}</div>
                  <div className="text-white/50 text-[10px] uppercase tracking-widest">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </FloatingCard>
    </div>
  )
}

function Hero() {
  const ref = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [0, 120])
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const smoothY = useSpring(y, { stiffness: 100, damping: 30 })

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-midnight text-white pt-20 pb-32 md:pt-28 md:pb-40"
    >
      <AmbientOrbs dark />
      <div className="container-max text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            <Sparkles className="w-4 h-4" />
            Setup & onboarding (a $497 value) is on us — limited time
          </div>
        </motion.div>

        <motion.h1
          className="text-4xl md:text-5xl lg:text-7xl font-bold mb-6 max-w-4xl mx-auto leading-[1.05]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          A website that works as <br className="hidden sm:block" />
          <ShimmerText dark>hard as your business does</ShimmerText>
        </motion.h1>

        <motion.p
          className="text-white/75 text-lg md:text-xl max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Custom websites for local businesses, built and maintained by the team behind moval.living. No contracts. Cancel anytime.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <MagneticButton
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent px-8 py-4 text-base"
          >
            <Calendar className="w-5 h-5" />
            Book a free call
          </MagneticButton>
          <MagneticButton
            href="#pricing"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-white/30 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 transition-colors"
          >
            See pricing <ArrowRight className="w-5 h-5" />
          </MagneticButton>
        </motion.div>
      </div>

      <motion.div
        className="container-max relative z-10"
        style={{ y: smoothY, opacity }}
      >
        <BeforeAfterBrowser />
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#f7f5f0] to-transparent z-0" />
    </section>
  )
}

function TrustBar() {
  return (
    <div className="bg-[#f8f9fb] border-b border-slate-200">
      <div className="container-max py-14">
        <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center" stagger={0.1}>
          {[
            { value: 497, prefix: '$', label: 'setup fee waived' },
            { value: 10, suffix: '–7', label: 'days to launch' },
            { value: 0, label: 'long-term contracts' },
            { value: 24, suffix: '/7', label: 'support included' },
          ].map((stat) => (
            <StaggerItem key={stat.label}>
              <div className="text-4xl sm:text-5xl font-bold text-[#081820]">
                <AnimatedNumber value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </div>
              <div className="text-sm text-[#5a6c72] uppercase tracking-wider font-medium">{stat.label}</div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </div>
  )
}

function FeaturesSection() {
  return (
    <section className="relative py-20 md:py-32 bg-mesh overflow-hidden">
      <div className="container-max relative z-10">
        <Reveal className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-flex items-center gap-2 text-[#00a8a8] text-sm font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-4 h-4" />
            What you get
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-[#081820] mb-5">Not just a website. A <span className="text-gradient">lead machine</span>.</h2>
          <p className="text-lg text-[#5a6c72]">Every site is designed around the things that actually drive revenue for local businesses.</p>
        </Reveal>

        <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto" stagger={0.08}>
          {features.map((card) => (
            <StaggerItem key={card.title}>
              <FloatingCard intensity={6} className="h-full">
                <div className="group bg-white rounded-2xl border border-slate-200 p-7 hover:border-[#00a8a8]/30 hover:shadow-xl transition-all h-full">
                  <div className={clsx(
                    'mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110 group-hover:rotate-3',
                    card.accent === 'coral' && 'bg-[#ff7a66]/10 text-[#ff7a66]',
                    card.accent === 'gold' && 'bg-[#f3c46c]/15 text-[#c79a3a]',
                    card.accent === 'primary' && 'bg-[#00a8a8]/10 text-[#00a8a8]',
                  )}>
                    <card.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[#081820] mb-2">{card.title}</h3>
                  <p className="text-[#5a6c72] leading-relaxed text-sm">{card.body}</p>
                </div>
              </FloatingCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}

function PricingSection() {
  return (
    <ParallaxSection offset={60}>
      <section id="pricing" className="scroll-mt-24 py-20 md:py-32 bg-[#061f2e] relative overflow-hidden">
        <AmbientOrbs dark />
        <div className="container-max relative z-10">
          <Reveal className="max-w-3xl mx-auto text-center mb-16">
            <span className="inline-flex items-center gap-2 text-[#ff7a66] text-sm font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-4 h-4" />
              Simple pricing
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-5">One monthly fee. Everything included.</h2>
            <p className="text-lg text-white/60">No setup fee right now. No contracts. Just a website and marketing system that runs itself.</p>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {tiers.map((tier, i) => (
              <Reveal key={tier.id} delay={i * 0.15}>
                <motion.div
                  whileHover={{ y: -8, transition: { type: 'spring', stiffness: 200, damping: 20 } }}
                  className={clsx(
                    'relative rounded-3xl border p-8 sm:p-10 overflow-hidden h-full',
                    i === 1
                      ? 'border-[#f3c46c]/50 bg-gradient-to-br from-[#0b3a52] to-[#061f2e] shadow-2xl shadow-[#f3c46c]/10'
                      : 'border-white/10 bg-white/5 backdrop-blur-sm'
                  )}
                >
                  {tier.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-[#f3c46c] to-[#e8b84d] text-[#081820] text-sm font-bold px-4 py-1 rounded-full flex items-center gap-1 shadow-lg">
                        <Sparkles className="w-3.5 h-3.5" />
                        {tier.badge}
                      </span>
                    </div>
                  )}
                  <h3 className="text-2xl font-bold mb-2 flex items-center gap-2 text-white">
                    {i === 1 ? <Sparkles className="w-6 h-6 text-[#f3c46c]" /> : <Globe className="w-6 h-6 text-[#00a8a8]" />}
                    {tier.name}
                  </h3>
                  <p className="text-white/60 mb-6 min-h-[3rem]">{tier.description}</p>
                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-5xl sm:text-6xl font-bold text-white">{tier.price}</span>
                    <span className="text-white/50 font-medium">{tier.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map(feature => (
                      <li key={feature} className="flex items-start gap-3 text-sm text-white/90">
                        <Check className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', i === 1 ? 'text-[#f3c46c]' : 'text-[#00a8a8]')} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <MagneticButton
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      'w-full inline-flex items-center justify-center gap-2 rounded-xl font-semibold px-6 py-4 transition-all',
                      i === 1
                        ? 'bg-gradient-to-r from-[#f3c46c] to-[#e8b84d] text-[#081820] hover:from-[#f5d17a] hover:to-[#ecc45a] shadow-lg shadow-[#f3c46c]/20'
                        : 'bg-gradient-to-r from-[#00a8a8] to-[#007a7f] text-white hover:brightness-110 shadow-lg shadow-[#00a8a8]/20'
                    )}
                  >
                    Book a Free Call <ArrowRight className="w-4 h-4" />
                  </MagneticButton>
                </motion.div>
              </Reveal>
            ))}
          </div>

          <p className="text-center text-white/40 mt-10 text-sm">Setup & onboarding (a $497 value) is currently waived for new clients.</p>
        </div>
      </section>
    </ParallaxSection>
  )
}

function ProcessSection() {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden bg-[#f8f9fb]">
      <div className="container-max relative z-10">
        <Reveal className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-flex items-center gap-2 text-[#00a8a8] text-sm font-semibold uppercase tracking-wider mb-3">
            <Clock className="w-4 h-4" />
            How it works
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-[#081820] mb-5">From first call to live site in under 48 hours</h2>
        </Reveal>

        <div className="relative max-w-6xl mx-auto">
          {/* Connecting line */}
          <div className="absolute top-16 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-[#00a8a8]/20 via-[#ff7a66]/30 to-[#f3c46c]/20 hidden md:block" />

          <StaggerContainer className="grid md:grid-cols-3 gap-8" stagger={0.15}>
            {process.map((step) => (
              <StaggerItem key={step.title}>
                <div className="relative group text-center md:text-left">
                  <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-lg mb-6 group-hover:border-[#00a8a8]/30 transition-colors">
                    <span className="text-3xl font-bold text-gradient">{step.step}</span>
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 glow-teal" />
                  </div>
                  <div className="mb-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                    <h3 className="text-xl font-bold text-[#081820]">{step.title}</h3>
                    <span className="rounded-full bg-white border border-slate-200 px-3 py-0.5 text-xs text-[#5a6c72] w-fit">{step.time}</span>
                  </div>
                  <p className="text-[#5a6c72] leading-relaxed text-sm">{step.body}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </div>
    </section>
  )
}

function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <section className="py-20 md:py-32 bg-white border-t border-slate-200">
      <div className="container-max">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-12">
            <span className="inline-flex items-center gap-2 text-[#00a8a8] text-sm font-semibold uppercase tracking-wider mb-3">
              <MessageSquare className="w-4 h-4" />
              Common questions
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#081820]">Questions? Answers.</h2>
          </Reveal>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <div className={clsx('rounded-2xl border border-slate-200 bg-[#f8f9fb] overflow-hidden transition-colors', openFaq === i && 'border-[#00a8a8]/30 bg-white shadow-lg')}>
                  <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 p-6 text-left">
                    <span className="font-semibold text-[#081820]">{faq.question}</span>
                    <motion.span
                      animate={{ rotate: openFaq === i ? 90 : 0 }}
                      className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 text-[#5a6c72]', openFaq === i && 'text-[#00a8a8] border-[#00a8a8]/30')}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </motion.span>
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: openFaq === i ? 'auto' : 0, opacity: openFaq === i ? 1 : 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 text-[#5a6c72] leading-relaxed text-sm">{faq.answer}</div>
                  </motion.div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden bg-midnight">
      <AmbientOrbs dark />
      <div className="container-max relative z-10">
        <Reveal className="max-w-4xl mx-auto text-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 sm:p-16 shadow-2xl">
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-5">Ready for a website that sells while you sleep?</h2>
          <p className="text-lg text-white/60 mb-8 max-w-2xl mx-auto">Book a free 20-minute demo call. We&apos;ll show you real sites, real results, and exactly what your build would look like.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <PulseRing>
              <MagneticButton
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent px-8 py-4 text-base"
              >
                <Calendar className="w-5 h-5" />
                Book a free call
              </MagneticButton>
            </PulseRing>
            <MagneticButton
              href={PHONE_HREF}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-white/20 text-white font-semibold px-8 py-4 hover:border-[#00a8a8] hover:text-[#00a8a8] transition-colors"
            >
              <Phone className="w-5 h-5" />
              {PHONE_NUMBER}
            </MagneticButton>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default function WebDesignClient() {
  return (
    <div className="bg-[#f8f9fb] min-h-screen">
      <Hero />
      <Marquee items={CATEGORY_TICKER} speed={45} />
      <TrustBar />
      <FeaturesSection />
      <PricingSection />
      <ProcessSection />
      <FaqSection />
      <ContactSection />
      <FinalCta />
    </div>
  )
}
