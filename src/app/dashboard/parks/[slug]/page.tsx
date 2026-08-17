import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { ParkEditor } from '@/components/admin/ParkEditor'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Edit Park — MoVal Living',
  robots: { index: false, follow: false },
}

export default async function EditParkPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const { slug } = await params
  const park = await prisma.park.findUnique({ where: { slug } })
  if (!park) notFound()

  // JSON-friendly shape (Date → ISO) for the client component.
  const json = {
    ...park,
    updatedAt: park.updatedAt.toISOString(),
    createdAt: park.createdAt.toISOString(),
  }
  return <ParkEditor initialPark={json} />
}
