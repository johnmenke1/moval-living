'use client'

import Link from 'next/link'
import { Building2, LogIn } from 'lucide-react'

export default function MySubmissionsPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <h1 className="text-3xl font-bold text-text mb-2">My Submissions</h1>
          <p className="text-text-secondary">Access businesses linked to your verified email</p>
        </div>
      </div>

      <div className="container-max py-12">
        <div className="max-w-xl mx-auto rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-text mb-2">Sign in to manage your listings</h2>
          <p className="text-sm text-text-secondary mb-6">
            We no longer expose submission details or claim links through an email search. Use your secure email sign-in link to open your owner dashboard.
          </p>
          <Link href="/login?callbackUrl=/dashboard" className="btn-primary inline-flex items-center justify-center gap-2">
            <LogIn className="h-4 w-4" /> Send My Sign-In Link
          </Link>
          <p className="mt-5 text-xs text-text-secondary">
            Need to add a business? <Link href="/submit" className="font-medium text-primary hover:underline">Submit it here</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
