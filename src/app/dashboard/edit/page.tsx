import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import EditBusinessClient from '@/components/business/EditBusinessClient'

export default async function EditBusinessPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    include: { business: true },
  })

  if (!owner?.business) {
    redirect('/dashboard')
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  })

  return (
    <EditBusinessClient
      business={owner.business as never}
      categories={categories as never}
    />
  )
}
