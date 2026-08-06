import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@/auth'
import AuthorEditor from '@/components/admin/AuthorEditor'

export const dynamic = 'force-dynamic'

export default async function NewAuthorPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <Link
            href="/dashboard/authors"
            className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Authors
          </Link>
          <h1 className="text-3xl font-bold text-text">Add Guest Author</h1>
          <p className="text-text-secondary">
            Create the public author profile. Posts are added separately.
          </p>
        </div>
      </div>
      <div className="container-max py-8">
        <div className="max-w-3xl mx-auto bg-white border border-slate-100 rounded-xl p-6">
          <AuthorEditor mode="create" />
        </div>
      </div>
    </div>
  )
}