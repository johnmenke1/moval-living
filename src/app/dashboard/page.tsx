'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, Star, Eye, Settings, Plus, ExternalLink, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

const mockBusiness = {
  id: 'demo-1',
  slug: 'demo-business-abc123',
  name: 'Riverside Carpet Cleaning',
  tagline: 'Moreno Valley\'s Trusted Cleaning Experts',
  tier: 'FEATURED',
  status: 'APPROVED',
  category: { name: 'Home Services' },
  reviews: [
    { id: 'r1', authorName: 'Maria G.', rating: 5, content: 'Incredible service! My carpets look brand new. Will definitely use again.', createdAt: new Date('2026-06-15') },
    { id: 'r2', authorName: 'Tom H.', rating: 4, content: 'Great job on the deep clean. A bit pricey but worth it.', createdAt: new Date('2026-05-22') },
  ],
  _count: { reviews: 2 },
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews'>('overview')

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Dashboard Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <h1 className="text-3xl font-bold text-text mb-1">Business Dashboard</h1>
          <p className="text-text-secondary">Manage your moval.living listing</p>
        </div>
      </div>

      <div className="container-max py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden sticky top-24">
              <div className="p-4 bg-gradient-to-br from-primary to-secondary">
                <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Your Business</p>
                <p className="text-white font-bold text-lg leading-tight">{mockBusiness.name}</p>
                <span className="inline-block mt-2 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">⭐ Featured</span>
              </div>
              <nav className="p-2">
                {[
                  { id: 'overview', label: 'Overview', icon: Building2 },
                  { id: 'reviews', label: 'Reviews', icon: Star },
                  { id: 'edit', label: 'Edit Listing', icon: Settings },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as typeof activeTab)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === item.id ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-slate-50 hover:text-text'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
                <hr className="my-2 border-slate-100" />
                <Link
                  href={`/business/${mockBusiness.slug}`}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-text-secondary hover:bg-slate-50 hover:text-text transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Live Listing
                </Link>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Reviews', value: '2', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
                { label: 'Avg Rating', value: '4.5 ★', icon: Eye, color: 'text-primary', bg: 'bg-blue-50' },
                { label: 'Listing Tier', value: 'Featured', icon: Building2, color: 'text-accent', bg: 'bg-orange-50' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-slate-100 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <p className="text-sm text-text-secondary">{stat.label}</p>
                  </div>
                  <p className="text-2xl font-bold text-text">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Upgrade CTA */}
            {mockBusiness.tier === 'FREE' && (
              <div className="bg-gradient-to-r from-accent to-orange-400 rounded-xl p-6 text-white">
                <h3 className="text-xl font-bold mb-1">Upgrade to Featured</h3>
                <p className="text-orange-100 text-sm mb-4">Get homepage visibility, priority ranking, and more photo slots.</p>
                <button className="bg-white text-accent font-bold px-6 py-2.5 rounded-lg hover:bg-orange-50 transition-colors">
                  Upgrade Now
                </button>
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="bg-white rounded-xl border border-slate-100 p-6">
                <h2 className="text-xl font-bold text-text mb-4">Quick Overview</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-text">Listing Status</p>
                      <p className="text-sm text-text-secondary">Published and visible to all users</p>
                    </div>
                    <span className="text-sm font-bold text-success bg-success/10 px-3 py-1 rounded-full">✅ Approved</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-text">Last Updated</p>
                      <p className="text-sm text-text-secondary">June 15, 2026</p>
                    </div>
                    <Link href={`/dashboard/business/${mockBusiness.id}/edit`} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                      Edit <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-text">Category</p>
                      <p className="text-sm text-text-secondary">{mockBusiness.category.name}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="bg-white rounded-xl border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-text">Reviews</h2>
                  <span className="text-sm text-text-secondary">{mockBusiness.reviews.length} total</span>
                </div>
                <div className="space-y-4">
                  {mockBusiness.reviews.map(review => (
                    <div key={review.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text">{review.authorName}</span>
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(star => (
                              <Star key={star} className={`w-3.5 h-3.5 ${star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-text-secondary">
                          {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary">{review.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
