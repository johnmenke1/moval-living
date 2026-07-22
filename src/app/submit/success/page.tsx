import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Submission Received',
  description: 'Your business listing has been submitted successfully.',
}

export default function SubmitSuccessPage() {
  return (
    <div className="bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-lg mx-auto text-center px-4">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
        <h1 className="text-3xl font-bold text-text mb-3">Listing Submitted!</h1>
        <p className="text-text-secondary text-lg mb-8 leading-relaxed">
          Thanks for listing <strong>{/* business name would go here */}</strong> on moval.living. Your listing will be reviewed and published within 1–2 business days. We&apos;ll send an email confirmation once it&apos;s live.
        </p>
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
