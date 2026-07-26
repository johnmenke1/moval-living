import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, MessageSquare } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import SocialPostsModeration from '@/components/admin/SocialPostsModeration'

export const dynamic = 'force-dynamic'

export default async function DashboardPostsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard/posts')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const posts = await prisma.socialPost.findMany({
    include: {
      business: { select: { id: true, slug: true, name: true, logo: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const pendingCount = posts.filter(p => p.status === 'PENDING').length

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-text mb-1 flex items-center gap-3">
                <MessageSquare className="w-7 h-7 text-primary" />
                Social Post Moderation
              </h1>
              <p className="text-text-secondary">
                Review submitted posts and approve or reject them
                {pendingCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    {pendingCount} pending
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-max py-8">
        <SocialPostsModeration initialPosts={posts} />
      </div>
    </div>
  )
}