import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import EditEventClient from '@/components/admin/EditEventClient'

export default async function EditEventPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const session = await auth()
  const { id } = await searchParams

  if (!session?.user?.id) {
    redirect('/login')
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  if (!id) {
    // No id → bounce to the events-admin tab where the picker lives.
    redirect('/dashboard?tab=events-admin')
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      venueTag: true,
      category: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      heroImageUrl: true,
      ticketUrl: true,
      isFree: true,
      tier: true,
      source: true,
      sourceUrl: true,
      createdAt: true,
      updatedAt: true,
      businessId: true,
      business: { select: { id: true, name: true, slug: true } },
    },
  })

  if (!event) {
    redirect('/dashboard')
  }

  return (
    <EditEventClient
      event={{
        ...event,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      }}
    />
  )
}
