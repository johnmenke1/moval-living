import { Suspense } from 'react'
import ResetPasswordForm from './ResetPasswordForm'

export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="bg-slate-50 min-h-screen flex items-center justify-center"><p className="text-text-secondary">Loading...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
