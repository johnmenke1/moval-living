import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, FileText, Plus } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import PostsAdmin from '@/components/admin/PostsAdmin'

export const dynamic = 'force-dynamic'

export default async function DashboardPostsQueuePage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard/posts-queue')
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const [posts, authors] = await Promise.all([
    prisma.guestPost.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        author: {
          select: { id: true, slug: true, displayName: true, photoUrl: true },
        },
      },
    }),
    prisma.guestAuthor.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
      select: { id: true, slug: true, displayName: true, photoUrl: true },
    }),
  ])

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
                <FileText className="w-7 h-7 text-primary" />
                Guest Posts
              </h1>
              <p className="text-text-secondary">
                Drafts, reviews, and published pieces from curated contributors
              </p>
            </div>
            <Link
              href="/dashboard/posts-queue/new"
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Post
            </Link>
          </div>
        </div>
      </div>
      <div className="container-max py-8">
        <PostsAdmin initialPosts={posts as never} authors={authors as never} />
      </div>
    </div>
  )
}