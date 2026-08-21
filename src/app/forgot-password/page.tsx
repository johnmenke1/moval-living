import { Suspense } from 'react'
import ForgotPasswordForm from './ForgotPasswordForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reset Your Password — moval.living',
  description: 'Request a password reset link for your moval.living account.',
  alternates: { canonical: 'https://www.moval.living/forgot-password' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="bg-slate-50 min-h-screen flex items-center justify-center"><p className="text-text-secondary">Loading...</p></div>}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
