import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/best-of/categories — list all categories with entries
export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const categories = await prisma.bestOfCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      entries: {
        include: {
          business: {
            select: { id: true, name: true, slug: true, address: true, website: true, logo: true },
          },
        },
        orderBy: { compositeScore: 'desc' },
      },
    },
  })

  return NextResponse.json(categories)
}

// POST /api/admin/best-of/categories — create a new category
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, slug, description, icon, query } = body

  if (!name || !slug || !icon || !query) {
    return NextResponse.json({ error: 'name, slug, icon, and query are required' }, { status: 400 })
  }

  const category = await prisma.bestOfCategory.create({
    data: { name, slug, description, icon, query },
  })

  return NextResponse.json(category, { status: 201 })
}
