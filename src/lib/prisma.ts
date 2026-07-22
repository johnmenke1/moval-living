import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    // Build-time fallback: instantiate without adapter so the build can proceed.
    // Connection errors will surface at runtime once DATABASE_URL is set.
    return new PrismaClient()
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma: PrismaClient = globalForPrisma.prisma ??= createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
