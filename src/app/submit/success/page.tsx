import Link from 'next/link'
import { CheckCircle, UserPlus, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Submission Received',
  description: 'Your business listing has been submitted successfully.',
}

interface Props {
  searchParams: Promise<{ name?: string; slug?: string; token?: string }>
}

export default async function SubmitSuccessPage({ searchParams }: Props) {
  const { name, slug, token } = await searchParams
  const hasToken = !!token && !!slug

  return (
    <div className="bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-lg mx-auto text-center px-4">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
        <h1 className="text-3xl font-bold text-text mb-3">Listing Submitted!</h1>
        <p className="text-text-secondary text-lg mb-2 leading-relaxed">
          Thanks for submitting <strong>{name || 'your business'}</strong> on moval.living.
        </p>
        <p className="text-text-secondary mb-8 leading-relaxed">
          Your listing will be reviewed and published within 1–2 business days. We&apos;ll send an email confirmation once it&apos;s live.
        </p>

        {/* Claim ownership CTA — shown when there's a valid token */}
        {hasToken ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-8 text-left">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-text mb-1">Claim your listing</h2>
                <p className="text-sm text-text-secondary">
                  Create a free account to manage your listing, reply to reviews, and post updates.
                </p>
              </div>
            </div>
            <Link
              href={`/claim?token=${token}&slug=${slug}`}
              className="btn-primary w-full justify-center flex items-center gap-2"
            >
              Create Free Account <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-text-secondary mt-3 text-center">
              Your claim link is valid for 7 days. No credit card required.
            </p>
          </div>
        ) : (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-8 text-sm text-text">
            💡 <strong>Want to manage your listing?</strong> Use the same email you submitted with
            to <Link href="/my-submissions" className="text-primary underline">find your submission</Link> and claim ownership.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/search" className="btn-primary inline-flex items-center justify-center gap-2">
            Browse Businesses
          </Link>
          <Link href="/" className="btn-outline inline-flex items-center justify-center gap-2">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
