import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import * as relations from './relations'
import { perRequestClient, hyperdriveUrl, requestScope } from '@/db/runtime'

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

function createPool(max: number): Pool {
  const pool = new Pool({
    // Placeholder lets `next build` import this module without a database.
    connectionString:
      hyperdriveUrl() ||
      process.env.DATABASE_URL ||
      'postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?sslmode=disable',
    max,
    idleTimeoutMillis: 1000,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 10000,
  })
  // pg-pool re-emits errors from IDLE clients (e.g. Neon or a proxy closing a
  // connection). With no listener Node treats that as an uncaught exception
  // and kills the process; the pool already discards the dead client.
  pool.on('error', (err) => {
    console.error('[db] idle client error (discarded):', err.message)
  })
  return pool
}

function getPool(): Pool {
  if (!globalForDb.__movalPool) globalForDb.__movalPool = createPool(2)
  return globalForDb.__movalPool
}

function makeDb() {
  return drizzle(getPool(), { schema: { ...schema, ...relations } })
}
type AppDb = ReturnType<typeof makeDb>

/** Worker: one pool + drizzle client per request scope (see runtime.worker.ts). */
function scopedDb(): AppDb {
  const scope = requestScope?.getStore()
  if (scope) {
    if (!scope.db) {
      // Workers allow 6 simultaneous outbound connections per request.
      const pool = createPool(5)
      scope.pool = pool
      scope.db = drizzle(pool, { schema: { ...schema, ...relations } })
    }
    return scope.db as AppDb
  }
  // No request scope (should not happen in a request): isolated one-off client.
  return drizzle(createPool(2), { schema: { ...schema, ...relations } })
}

/**
 * On Node the client is a module singleton. On Workers (perRequestClient) it
 * resolves to the current request's client: sockets cannot be shared across
 * requests there.
 */
export const db: AppDb = perRequestClient
  ? (new Proxy({} as AppDb, {
      get(_t, prop) {
        const real = scopedDb() as unknown as Record<string | symbol, unknown>
        const v = real[prop]
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v
      },
    }) as AppDb)
  : makeDb()
export * from './schema'
export * from './errors'
export * from './sql'
export type Db = typeof db
