/**
 * Error helpers that replace Prisma's error codes.
 *
 *   Prisma P2002 (unique constraint)  ->  isUniqueViolation(err)   (Postgres 23505)
 *   Prisma P2025 (record not found)   ->  requireRow(rows, msg)    (Drizzle returns [] instead of throwing)
 *
 * drizzle-orm >= 0.44 wraps driver errors in DrizzleQueryError and keeps the
 * original pg error on `.cause`, so look at both levels.
 */

export class NotFoundError extends Error {
  constructor(message = 'Record not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

function pgCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as { code?: unknown; cause?: unknown }
  if (typeof e.code === 'string') return e.code
  return pgCode(e.cause)
}

/** Postgres unique_violation (23505) — the old Prisma P2002. */
export function isUniqueViolation(err: unknown): boolean {
  return pgCode(err) === '23505'
}

/** Postgres foreign_key_violation (23503) — the old Prisma P2003. */
export function isForeignKeyViolation(err: unknown): boolean {
  return pgCode(err) === '23503'
}

/**
 * `update(...).returning()` / `delete(...).returning()` give back [] when no
 * row matched, where Prisma's update()/delete() threw P2025. Use this to keep
 * the "throws when missing" behavior.
 */
export function requireRow<T>(rows: T[], message?: string): T {
  const row = rows[0]
  if (row === undefined) throw new NotFoundError(message)
  return row
}
