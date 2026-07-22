import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Building2, Star, Eye, Settings, ExternalLink, CheckCircle, Clock, XCircle, Tag, MessageSquare, Plus } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    include: {
      business: {
        include: {
          category: true,
          reviews: { orderBy: { createdAt: 'desc' }, take: 5 },
          _count: { select: { reviews: true } },
        },
      },
    },
  })

  if (!owner || !owner.business) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <div className="container-max py-8">
          <h1 className="text-3xl font-bold text-text mb-1">Business Dashboard</h1>
          <p className="text-text-secondary mb-8">Manage your moval.living listing</p>
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">No business linked to your account</h2>
            <p className="text-text-secondary mb-6 max-w-md mx-auto">
              Your account isn&apos;t linked to a business listing yet. Claim your listing to get started.
            </p>
            <Link href="/claim" className="btn-primary">
              Claim Your Business
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const business = owner.business
  const avgRating = business.reviews.length > 0
    ? (business.reviews.reduce((sum, r) => sum + r.rating, 0) / business.reviews.length).toFixed(1)
    : null

  const statusConfig = {
    APPROVED: { label: 'Published', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    PENDING: { label: 'Pending Review', icon: Clock, color: 'text-amber-600 bg-amber-50' },
    REJECTED: { label: 'Rejected', icon: XCircle, color: 'text-red-600 bg-red-50' },
  }[business.status]

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
                <p className="text-white font-bold text-lg leading-tight">{business.name}</p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${
                  business.tier === 'FEATURED'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 text-white/80'
                }`}>
                  {business.tier === 'FEATURED' ? '⭐ Featured' : 'Free'}
                </span>
              </div>
              <nav className="p-2">
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  'bg-primary/10 text-primary'
                }`}>
                  <Building2 className="w-4 h-4" /> Overview
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                  <Star className="w-4 h-4" /> Reviews
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                  <Settings className="w-4 h-4" /> Edit Listing
                </div>
              </nav>
              <div className="p-4 border-t border-slate-100">
                <a
                  href={`/business/${business.slug}`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 w-full text-sm text-text-secondary hover:text-primary transition-colors"
                >
                  <Eye className="w-4 h-4" /> View Live Listing
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Status', value: statusConfig.label, icon: statusConfig.icon, color: statusConfig.color },
                { label: 'Rating', value: avgRating ? `${avgRating} ★` : 'No ratings', icon: Star, color: 'text-amber-600 bg-amber-50' },
                { label: 'Reviews', value: business._count.reviews, icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
                { label: 'Tier', value: business.tier === 'FEATURED' ? 'Featured' : 'Free', icon: Tag, color: 'text-purple-600 bg-purple-50' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-slate-100 p-4">
                  <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-bold text-text">{stat.value}</p>
                  <p className="text-xs text-text-secondary">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Business Info Card */}
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-text">{business.name}</h2>
                  <p className="text-text-secondary text-sm">{business.category.name}</p>
                </div>
                {business.hasCoupon && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-accent/10 text-accent px-3 py-1 rounded-full">
                    <Tag className="w-3 h-3" /> Active Deal
                  </span>
                )}
              </div>
              {business.tagline && (
                <p className="text-text-secondary text-sm mb-4">{business.tagline}</p>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {business.address && (
                  <div>
                    <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Address</p>
                    <p className="text-text">{business.address}, {business.city} {business.state} {business.zip}</p>
                  </div>
                )}
                {business.phone && (
                  <div>
                    <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Phone</p>
                    <p className="text-text">{business.phone}</p>
                  </div>
                )}
                {business.website && (
                  <div>
                    <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Website</p>
                    <a href={business.website} target="_blank" className="text-primary hover:underline">{business.website}</a>
                  </div>
                )}
                {business.email && (
                  <div>
                    <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Email</p>
                    <p className="text-text">{business.email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Reviews */}
            {business.reviews.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-6">
                <h2 className="text-lg font-bold text-text mb-4">Recent Reviews</h2>
                <div className="space-y-4">
                  {business.reviews.map(review => (
                    <div key={review.id} className="border-b border-slate-50 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text text-sm">{review.authorName}</span>
                          <div className="flex">
                            {[1,2,3,4,5].map(i => (
                              <Star key={i} className={`w-3.5 h-3.5 ${i <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
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

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-text mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/submit" className="flex items-center gap-3 p-4 rounded-lg border border-slate-100 hover:border-primary hover:bg-primary/5 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-text text-sm">Add Deal</p>
                    <p className="text-xs text-text-secondary">Create a coupon</p>
                  </div>
                </Link>
                <a href={`/business/${business.slug}`} target="_blank" className="flex items-center gap-3 p-4 rounded-lg border border-slate-100 hover:border-primary hover:bg-primary/5 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-text text-sm">View Live</p>
                    <p className="text-xs text-text-secondary">See your listing</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
