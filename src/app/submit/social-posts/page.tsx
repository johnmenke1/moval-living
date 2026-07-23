import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import SubmitPostForm from '@/components/social/SubmitPostForm'

export default async function SubmitSocialPostPage() {
  const businesses = await prisma.business.findMany({
    where: { status: 'APPROVED' },
    select: { id: true, name: true, slug: true, logo: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--background, #f0efeb)' }}>
      <div className="container-max py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary, #1a2e35)' }}>
            Submit a Social Post
          </h1>
          <p style={{ color: 'var(--text-secondary, #5a6c72)' }}>
            Share an Instagram or Facebook post highlighting a local event or opportunity.
            We&apos;ll review it and add it to the community feed.
          </p>
        </div>

        {/* Info card */}
        <div
          className="mb-8 p-4 rounded-xl border border-slate-200 flex items-start gap-3"
          style={{ background: 'var(--surface, #fff)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'var(--primary, #007a7f)', opacity: 0.1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #007a7f)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary, #1a2e35)' }}>
              Community Moderation
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary, #5a6c72)' }}>
              All submitted posts are reviewed by our team before appearing on the events page.
              Posts should highlight local Moreno Valley events, specials, or opportunities.
            </p>
          </div>
        </div>

        {/* Form */}
        <div
          className="max-w-2xl"
          style={{ background: 'var(--surface, #fff)', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px' }}
        >
          <SubmitPostForm businesses={businesses} />
        </div>
      </div>
    </div>
  )
}
