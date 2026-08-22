import { Suspense } from 'react'
import type { Metadata } from 'next'
import RegisterForm from './RegisterForm'

export const metadata: Metadata = {
  title: 'Create Account — moval.living',
  description:
    'Create a free MoVal.living account to vote in Best Of MoVal, claim your business, and engage with the community.',
  alternates: { canonical: 'https://www.moval.living/register' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-slate-50 min-h-screen flex items-center justify-center">
          <p className="text-text-secondary">Loading…</p>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
