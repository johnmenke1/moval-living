'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, MapPin, ArrowRight, Star, ChevronRight } from 'lucide-react'
import { categories } from '@/data/categories'

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (selectedCategory) params.set('category', selectedCategory)
    window.location.href = `/search?${params.toString()}`
  }

  return (
    <div className="flex flex-col">
      {/* ─── HERO ─── */}
      <section className="relative bg-gradient-to-br from-primary via-blue-600 to-secondary overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/10 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
        
        <div className="container-max relative py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-sm px-4 py-1.5 rounded-full mb-6">
              <MapPin className="w-4 h-4 text-secondary" />
              Moreno Valley, California
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Discover Moreno Valley&apos;s{' '}
              <span className="text-secondary">Best Local Businesses</span>
            </h1>
            
            <p className="text-lg md:text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Your trusted guide to finding restaurants, contractors, healthcare, and more — all verified and reviewed by your neighbors.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl p-2 shadow-2xl max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="What are you looking for?"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl text-text placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="sm:w-48 px-4 py-3.5 rounded-xl text-text bg-slate-50 border-0 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
                <button type="submit" className="btn-accent flex items-center justify-center gap-2 py-3.5 px-8">
                  Search
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Quick category pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {categories.slice(0, 5).map(cat => (
                <Link
                  key={cat.id}
                  href={`/search?category=${cat.slug}`}
                  className="text-sm text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-all duration-150"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURED BUSINESSES ─── */}
      <section className="section bg-white">
        <div className="container-max">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-text mb-1">Featured Businesses</h2>
              <p className="text-text-secondary">Top-rated local businesses in Moreno Valley</p>
            </div>
            <Link href="/search?tier=FEATURED" className="hidden sm:flex items-center gap-1 text-primary font-medium hover:gap-2 transition-all">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Placeholder cards — will come from DB */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="card-featured p-6 animate-pulse">
                <div className="bg-slate-200 rounded-xl w-full h-40 mb-4" />
                <div className="bg-slate-200 rounded-lg h-5 w-3/4 mb-3" />
                <div className="bg-slate-200 rounded-lg h-4 w-1/2 mb-4" />
                <div className="flex items-center gap-1 mb-4">
                  {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 text-slate-300" />)}
                  <span className="text-sm text-text-secondary ml-1">No reviews yet</span>
                </div>
                <div className="bg-slate-200 rounded-lg h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BROWSE BY CATEGORY ─── */}
      <section className="section bg-slate-50">
        <div className="container-max">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-text mb-3">Browse by Category</h2>
            <p className="text-text-secondary text-lg">Find exactly what you need — fast</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {categories.map(category => (
              <Link
                key={category.id}
                href={`/search?category=${category.slug}`}
                className="group bg-white rounded-xl p-4 flex flex-col items-center text-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all duration-150 border border-slate-100"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${categoryColors[category.id] || '#2563EB'}15, ${categoryColors[category.id] || '#2563EB'}30)`,
                  }}
                >
                  🏠
                </div>
                <div>
                  <p className="font-semibold text-text text-sm leading-tight">{category.name}</p>
                  <p className="text-xs text-text-secondary mt-1">View all →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="section bg-white">
        <div className="container-max">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-text mb-3">How It Works</h2>
            <p className="text-text-secondary text-lg">Finding and supporting local has never been easier</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Search', desc: 'Browse by category or search for a specific business. Filter by rating, distance, and more.', icon: '🔍' },
              { step: '2', title: 'Connect', desc: 'View full business profiles with photos, hours, maps, and genuine reviews from your neighbors.', icon: '🤝' },
              { step: '3', title: 'Support', desc: 'Choose local first. Every dollar you spend at a local business keeps Moreno Valley thriving.', icon: '❤️' },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mx-auto mb-4">
                  {item.icon}
                </div>
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-sm font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-text mb-2">{item.title}</h3>
                <p className="text-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="py-16 bg-gradient-to-r from-accent to-orange-400">
        <div className="container-max text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Own a Business in Moreno Valley?
          </h2>
          <p className="text-orange-100 text-lg mb-8 max-w-2xl mx-auto">
            Get listed for FREE and reach thousands of local customers. Upgrade to Featured to appear on the homepage and rank higher in search.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/submit" className="bg-white text-accent font-bold px-8 py-3.5 rounded-lg hover:bg-orange-50 transition-colors inline-flex items-center justify-center gap-2">
              List My Business Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/#pricing" className="border-2 border-white text-white font-bold px-8 py-3.5 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center">
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

const categoryColors: Record<string, string> = {
  restaurants: '#F97316',
  contractors: '#8B5CF6',
  healthcare: '#22C55E',
  retail: '#EC4899',
  automotive: '#3B82F6',
  professional: '#6366F1',
  beauty: '#F59E0B',
  'home-services': '#14B8A6',
  education: '#EF4444',
  pets: '#A855F7',
  finance: '#0EA5E9',
  auto: '#64748B',
}
