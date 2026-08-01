import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import EditBusinessClient from '@/components/business/EditBusinessClient'

export default async function EditBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const session = await auth()
  const { id } = await searchParams

  if (!session?.user?.id) {
    redirect('/login')
  }

  const isAdmin = session.user.role === 'ADMIN'

  // Admin can pass ?id= to edit any business
  if (isAdmin && id) {
    const business = await prisma.business.findUnique({
      where: { id },
      include: { category: true },
    })
    if (!business) redirect('/dashboard')
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
    return (
      <EditBusinessClient
        business={{
          ...business,
          hours: (business.hours as Record<string, { open: string; close: string; closed: boolean }>) || null,
          coupon: business.coupon as { headline: string; description: string; code: string | null; expiresAt: string | null } | null,
        } as never}
        categories={categories as never}
      />
    )
  }

  // Owner editing their own business
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

