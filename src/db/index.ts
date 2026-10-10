import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import * as relations from './relations'

/**
 * Single Drizzle client for the whole app.
 *
 * The pool is deliberately small and short-lived (see the long comment this
 * replaced the Prisma client): serverless instances are short-lived, and
 * idle sockets left open keep a metered Postgres (Neon) awake and billed.
 * Keep max/idle settings in this one place — never build a second Pool.
 *
 * `pg` is also what Cloudflare Hyperdrive expects, so this module only needs
 * its connection string swapped when the app moves to Workers.
 */
const globalForDb = globalThis as unknown as { __movalPool?: Pool }

function getPool(): Pool {
  if (!globalForDb.__movalPool) {
    globalForDb.__movalPool = new Pool({
      // Placeholder lets `next build` import this module without a database.
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?sslmode=disable',
      max: 2,
      idleTimeoutMillis: 1000,
      allowExitOnIdle: true,
      connectionTimeoutMillis: 10000,
    })
    // pg-pool re-emits errors from IDLE clients (e.g. Neon or a proxy closing a
    // connection). With no listener Node treats that as an uncaught exception
    // and kills the process; the pool already discards the dead client.
    globalForDb.__movalPool.on('error', (err) => {
      console.error('[db] idle client error (discarded):', err.message)
    })
  }
  return globalForDb.__movalPool
}

export const db = drizzle(getPool(), { schema: { ...schema, ...relations } })
export * from './schema'
export * from './errors'
export * from './sql'
export type Db = typeof db
