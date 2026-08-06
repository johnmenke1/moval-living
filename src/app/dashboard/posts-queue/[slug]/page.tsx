import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import PostEditor from '@/components/admin/PostEditor'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export default async function EditPostPage({ params }: Ctx) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const { slug } = await params
  const post = await prisma.guestPost.findUnique({
    where: { slug },
    include: { author: true },
  })
  if (!post) notFound()

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
          <h1 className="text-3xl font-bold text-text">{post.title}</h1>
          <p className="text-text-secondary">
            /insights/{post.slug} · {statusLabel(post.status)}
            {post.scheduledFor &&
              ` · scheduled for ${new Date(post.scheduledFor).toLocaleString()}`}
          </p>
        </div>
      </div>
      <div className="container-max py-8">
        <div className="bg-white border border-slate-100 rounded-xl p-6">
          <PostEditor
            mode="edit"
            initial={post as never}
            authors={authors as never}
          />
        </div>
      </div>
    </div>
  )
}

function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}