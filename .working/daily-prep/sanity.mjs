// Sanity check — count Submissions by status (any recency)
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const lines = readFileSync('./.env.local', 'utf8').split('\n')
const get = (k) => {
  const l = lines.find((x) => x.startsWith(k + '='))
  if (!l) return ''
  return l.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
}
const DATABASE_URL = process.env.DATABASE_URL || get('DATABASE_URL')
const pool = new Pool({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const groups = await prisma.submission.groupBy({
  by: ['status'],
  _count: { _all: true },
})
const latest = await prisma.submission.findMany({
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: { slug: true, status: true, title: true, createdAt: true },
})
console.log(JSON.stringify({ groups, latest }, null, 2))
await prisma.$disconnect()