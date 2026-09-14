import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Building2 } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import ManualAddBusinessClient from '@/components/admin/ManualAddBusinessClient'

// /dashboard/add/manual — admin-only entry to the manual business
// creation form. Companion to /dashboard/add (Google Places import).
// Johnny asked for both on 2026-09-14. See
// .hermes/plans/2026-09-14_moval-living-admin-manual-add.md.

export default async function ManualAddBusinessPage() {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  })

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary mb-3 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-text">Add Business Manually</h1>
          </div>
          <p className="text-text-secondary">
            Create a business listing by entering the details yourself. Use this when the business isn&apos;t on Google, or when Google has wrong data.
          </p>
          <p className="text-xs text-text-secondary mt-2">
            Looking to import from Google?{' '}
            <Link href="/dashboard/add" className="text-primary hover:underline">
              Use the Google Places importer
            </Link>{' '}
            instead.
          </p>
        </div>
      </div>

      <div className="container-max py-8">
        <div className="max-w-2xl mx-auto">
          <ManualAddBusinessClient categories={categories as never[]} />
        </div>
      </div>
    </div>
  )
}
