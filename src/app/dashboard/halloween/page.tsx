import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@/auth'
import HalloweenAdmin from '@/components/admin/HalloweenAdmin'

export const dynamic = 'force-dynamic'

export default async function DashboardHalloweenPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=/dashboard/halloween')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Haunted Homes contest</h1>
          <p className="text-sm text-slate-500">Review entries, fix pins, and approve homes for the public map.</p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <HalloweenAdmin />
      </div>
    </div>
  )
}
