import { Suspense } from 'react'
import ForgotPasswordForm from './ForgotPasswordForm'

export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="bg-slate-50 min-h-screen flex items-center justify-center"><p className="text-text-secondary">Loading...</p></div>}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
