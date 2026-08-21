import { Suspense } from 'react'
import LoginForm from './LoginForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In — moval.living',
  description: 'Sign in to your moval.living account to manage your business listing.',
  alternates: { canonical: 'https://www.moval.living/login' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bg-slate-50 min-h-screen flex items-center justify-center"><p className="text-text-secondary">Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  )
}
