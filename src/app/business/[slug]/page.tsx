import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { averageRating, formatPhone } from '@/lib/utils'
import { MapPin, Phone, Globe, Mail, Clock, Star, ChevronRight } from 'lucide-react'
import { BusinessMapWrapper } from '@/components/map/BusinessMapWrapper'

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}
import { ReviewList } from '@/components/reviews/ReviewList'
import { ContactBusinessForm } from '@/components/forms/ContactBusinessForm'
import type { Metadata } from 'next'

interface BusinessPageProps {
  params: Promise<{ slug: string }>
}

async function getBusiness(slug: string) {
  const business = await prisma.business.findUnique({
    where: { slug, status: 'APPROVED' },
    include: {
      category: true,
      reviews: {
        orderBy: { createdAt: 'desc' },
        where: { flagged: false },
      },
    },
  })
  return business
}

export async function generateMetadata({ params }: BusinessPageProps): Promise<Metadata> {
  const { slug } = await params
  const business = await getBusiness(slug)
  if (!business) return { title: 'Business Not Found' }
  
  return {
    title: business.metaTitle || business.name,
    description: business.metaDescription || business.description.slice(0, 160),
    openGraph: {
      title: business.name,
      description: business.description.slice(0, 200),
      images: business.coverImage ? [business.coverImage] : [],
    },
  }
}

export default async function BusinessPage({ params }: BusinessPageProps) {
  const { slug } = await params
  const business = await getBusiness(slug)
  if (!business) notFound()

  const rating = averageRating(business.reviews)
  const hours = business.hours as Record<string, { open: string; close: string; closed: boolean }> | null

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-3">
          <nav className="flex items-center gap-2 text-sm text-text-secondary">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/search" className="hover:text-primary transition-colors">Browse</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/search?category=${business.category.slug}`} className="hover:text-primary transition-colors">
              {business.category.name}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-text font-medium truncate">{business.name}</span>
          </nav>
        </div>
      </div>

      <div className="container-max py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ─── MAIN CONTENT ─── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {/* Cover Image */}
              <div className="relative h-56 md:h-72 bg-gradient-to-br from-primary/20 to-secondary/20">
                {business.coverImage ? (
                  <img src={business.coverImage} alt={business.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-7xl font-bold text-primary/20">{business.name[0]}</span>
                  </div>
                )}
                {business.tier === 'FEATURED' && (
                  <div className="absolute top-4 left-4 bg-accent text-white text-sm font-bold px-3 py-1.5 rounded-full">
                    ⭐ Featured Business
                  </div>
                )}
              </div>

              <div className="p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
                  {business.logo && (
                    <img src={business.logo} alt={`${business.name} logo`} className="w-20 h-20 rounded-xl object-cover border-2 border-white shadow-md -mt-14 sm:-mt-16 mb-2 sm:mb-0" />
                  )}
                  <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-text mb-1">{business.name}</h1>
                    {business.tagline && <p className="text-accent font-medium text-lg mb-2">{business.tagline}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                      <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">{business.category.name}</span>
                      {rating > 0 && (
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(star => (
                            <Star key={star} className={`w-4 h-4 ${star <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                          ))}
                          <span className="font-medium text-text ml-1">{rating.toFixed(1)}</span>
                          <span>({business.reviews.length} review{business.reviews.length !== 1 ? 's' : ''})</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="prose prose-slate max-w-none mb-8">
                  <p className="text-text-secondary leading-relaxed whitespace-pre-line">{business.description}</p>
                </div>

                {/* Quick Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {business.address && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text">Address</p>
                        <p className="text-sm text-text-secondary">{business.address}</p>
                        <p className="text-sm text-text-secondary">{business.city}, {business.state} {business.zip}</p>
                      </div>
                    </div>
                  )}
                  {business.phone && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <Phone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text">Phone</p>
                        <a href={`tel:${business.phone}`} className="text-sm text-primary hover:underline">{formatPhone(business.phone)}</a>
                      </div>
                    </div>
                  )}
                  {business.email && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <Mail className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text">Email</p>
                        <a href={`mailto:${business.email}`} className="text-sm text-primary hover:underline">{business.email}</a>
                      </div>
                    </div>
                  )}
                  {business.website && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <Globe className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text">Website</p>
                        <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          {business.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hours */}
                {hours && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-text mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      Hours of Operation
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(hours).map(([day, hours]) => (
                        <div key={day} className="text-sm p-3 bg-slate-50 rounded-lg">
                          <p className="font-medium text-text capitalize">{day}</p>
                          <p className="text-text-secondary">
                            {hours.closed ? 'Closed' : `${hours.open} – ${hours.close}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Links */}
                {(business.facebook || business.instagram || business.yelp || business.googleBusiness) && (
                  <div className="flex flex-wrap gap-3">
                    {business.facebook && (
                      <a href={business.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                        <FacebookIcon className="w-4 h-4" /> Facebook
                      </a>
                    )}
                    {business.instagram && (
                      <a href={business.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm font-medium">
                        <InstagramIcon className="w-4 h-4" /> Instagram
                      </a>
                    )}
                    {business.yelp && (
                      <a href={business.yelp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium">
                        Y
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Map */}
            {business.address && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Location
                  </h2>
                </div>
                <div className="h-72 min-h-[288px]">
                  <BusinessMapWrapper
                    address={business.address}
                    city={business.city}
                    state={business.state}
                    zip={business.zip}
                    name={business.name}
                    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                  />
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
              <ReviewList businessId={business.id} businessSlug={business.slug} initialReviews={business.reviews} />
            </div>
          </div>

          {/* ─── SIDEBAR ─── */}
          <div className="space-y-6">
            {/* Contact Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-lg font-bold text-text mb-4">Contact {business.name}</h3>
              <ContactBusinessForm businessName={business.name} businessSlug={business.slug} />
            </div>

            {/* Claim CTA */}
            <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl p-6 text-white">
              <h3 className="text-lg font-bold mb-2">Are you the owner?</h3>
              <p className="text-blue-100 text-sm mb-4">Claim your free listing and update your business information.</p>
              <Link href={`/claim?business=${business.slug}`} className="block text-center bg-white text-primary font-bold py-2.5 px-4 rounded-lg hover:bg-blue-50 transition-colors">
                Claim This Business
              </Link>
            </div>

            {/* Website Upsell */}
            <div className="bg-accent/10 border border-accent/20 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-text mb-2">Need a Website?</h3>
              <p className="text-text-secondary text-sm mb-4">We build professional websites for local businesses. Get yours started today!</p>
              <a href="mailto:hello@moval.living?subject=Website%20Inquiry" className="block text-center btn-accent text-sm">
                Get a Free Quote
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
