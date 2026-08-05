import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import PlacesSearchClient from '@/components/admin/PlacesSearchClient'

export default async function AddBusinessPage() {
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
          <h1 className="text-3xl font-bold text-text mb-1">Add Business</h1>
          <p className="text-text-secondary">Import a business from Google directly into the directory</p>
        </div>
      </div>
      <div className="container-max py-8">
        <div className="max-w-2xl mx-auto">
          <PlacesSearchClient categories={categories as never[]} />
        </div>
      </div>
    </div>
  )
}
