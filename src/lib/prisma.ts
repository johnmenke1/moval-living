import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Build a Prisma client.
 *
 * Prisma 7 REQUIRES a driver adapter — `new PrismaClient()` with no args
 * throws immediately. So we always supply a PrismaPg adapter, even when
 * DATABASE_URL is missing. The adapter is constructed with a placeholder
 * connection string in that case so module evaluation can complete; any
 * actual query at runtime will fail with a real connection error, which
 * is what we want — the alternative is the build crashing on `next build`
 * for every page that imports this module.
 */
function buildPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?sslmode=disable'

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = buildPrismaClient()
  }
  return globalForPrisma.prisma
}

/**
 * Back-compat Proxy: lets every existing `import { prisma } from '@/lib/prisma'`
 * call site (`prisma.business.findMany(...)`, etc.) keep working without a
 * codebase-wide refactor. Defers real client construction until first access.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = getPrisma()
}
