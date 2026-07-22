'use client'

import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function ClaimSuccessPage() {
  return (
    <div className="bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-lg mx-auto text-center px-4">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
        <h1 className="text-3xl font-bold text-text mb-3">Business Claimed!</h1>
        <p className="text-text-secondary text-lg mb-8 leading-relaxed">
          You&apos;ve successfully claimed this business listing. Check your email for next steps to verify your ownership and access your dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard" className="btn-primary inline-flex items-center justify-center gap-2">
            Go to Dashboard
          </Link>
          <Link href="/" className="btn-outline inline-flex items-center justify-center gap-2">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
