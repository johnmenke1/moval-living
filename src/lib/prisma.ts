import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
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
 *
 * Pool sizing (changed 2026-10-07 to cut Neon compute bill):
 *   - max: 2  — Vercel function instances are short-lived (~5s) and we
 *     never need more than a couple of concurrent queries per request.
 *     The previous default of 10 was leaving idle sockets open when
 *     functions exited without calling pool.end(), which Neon counts
 *     as "active compute" and bills against the Launch plan's 24/7
 *     always-on minimum.
 *   - idleTimeoutMillis: 1000 — close idle sockets fast (1s). Default
 *     is 10s; 1s matches Vercel function lifetime.
 *   - allowExitOnIdle: true — let the process exit cleanly even with
 *     idle connections, so Vercel can recycle the function instance.
 *   - connectionTimeoutMillis: 10000 — fail fast instead of hanging.
 */
function buildPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?sslmode=disable'

  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 1000,
      allowExitOnIdle: true,
      connectionTimeoutMillis: 10000,
    })
  }
  const pool = globalForPrisma.pool
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

// Best-effort cleanup when the Vercel function instance is recycled.
// Without this, the pool's idle sockets stay open until Neon's
// idle_timeout (which is on the order of minutes), and each one
// counts against the always-on compute minimum.
if (process.env.NODE_ENV === 'production') {
  const cleanup = () => {
    if (globalForPrisma.pool) {
      globalForPrisma.pool.end().catch(() => {
        // Swallow — we're shutting down anyway.
      })
    }
  }
  process.once('SIGTERM', cleanup)
  process.once('SIGINT', cleanup)
}