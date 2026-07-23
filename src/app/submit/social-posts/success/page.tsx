import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function SubmitSocialPostSuccessPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background, #f0efeb)' }}>
      <div className="container-max py-8">
        <div
          className="max-w-md mx-auto text-center"
          style={{ background: 'var(--surface, #fff)', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '48px 32px' }}
        >
          <CheckCircle
            className="w-16 h-16 mx-auto mb-4"
            style={{ color: 'var(--success, #22C55E)' }}
          />
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary, #1a2e35)' }}>
            Post Submitted!
          </h1>
          <p className="mb-6" style={{ color: 'var(--text-secondary, #5a6c72)' }}>
            Thanks for sharing. Your post is now in the review queue and we&apos;ll add it to the events
            page once approved.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/events"
              className="w-full py-3 text-center bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
            >
              View Events
            </Link>
            <Link
              href="/submit"
              className="w-full py-3 text-center border border-slate-200 text-text font-medium rounded-xl hover:bg-slate-50 transition-colors"
            >
              Submit Another
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
