import { NextResponse } from 'next/server'
import { asc } from 'drizzle-orm'
import { db, category } from '@/db'

export async function GET() {
  try {
    const categories = await db.query.category.findMany({
      orderBy: asc(category.name),
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Categories fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
