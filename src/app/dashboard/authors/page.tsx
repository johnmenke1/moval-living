import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, UserPlus, Users } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import AuthorsAdmin from '@/components/admin/AuthorsAdmin'

export const dynamic = 'force-dynamic'

export default async function DashboardAuthorsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard/authors')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const authors = await prisma.guestAuthor.findMany({
    orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    include: { _count: { select: { posts: true } } },
  })

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
                <Users className="w-7 h-7 text-primary" />
                Guest Authors
              </h1>
              <p className="text-text-secondary">
                Curated contributors to MoVal Living&apos;s editorial voice
              </p>
            </div>
            <Link
              href="/dashboard/authors/new"
              className="btn-primary inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Author
            </Link>
          </div>
        </div>
      </div>
      <div className="container-max py-8">
        <AuthorsAdmin initialAuthors={authors as never} />
      </div>
    </div>
  )
}