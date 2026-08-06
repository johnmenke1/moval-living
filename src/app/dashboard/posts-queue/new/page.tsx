import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import PostEditor from '@/components/admin/PostEditor'

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const authors = await prisma.guestAuthor.findMany({
    where: { isActive: true },
    orderBy: { displayName: 'asc' },
    select: { id: true, slug: true, displayName: true, photoUrl: true },
  })

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <Link
            href="/dashboard/posts-queue"
            className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Posts
          </Link>
          <h1 className="text-3xl font-bold text-text">New Guest Post</h1>
          <p className="text-text-secondary">
            Author it, draft it, then move it through the workflow.
          </p>
        </div>
      </div>
      <div className="container-max py-8">
        <div className="bg-white border border-slate-100 rounded-xl p-6">
          <PostEditor mode="create" authors={authors as never} />
        </div>
      </div>
    </div>
  )
}