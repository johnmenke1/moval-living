import { Suspense } from 'react'
import ResetPasswordForm from './ResetPasswordForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Choose a New Password — moval.living',
  description: 'Set a new password for your moval.living account.',
  alternates: { canonical: 'https://www.moval.living/reset-password' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="bg-slate-50 min-h-screen flex items-center justify-center"><p className="text-text-secondary">Loading...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
