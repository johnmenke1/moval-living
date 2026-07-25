import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// PATCH /api/admin/businesses/[id] — approve or reject a business
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { status } = body

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'Status must be APPROVED or REJECTED' }, { status: 400 })
  }

  const business = await prisma.business.update({
    where: { id },
    data: { status },
    include: {
      category: { select: { name: true, slug: true } },
      owner: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(business)
}

// DELETE /api/admin/businesses/[id] — permanently delete a business
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  await prisma.business.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
