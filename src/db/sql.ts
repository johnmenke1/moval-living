/**
 * Escape `%`, `_` and `\` so user input can be embedded in a LIKE/ILIKE
 * pattern as literal text. Prisma's `contains` / `startsWith` did this
 * implicitly; Drizzle's `like` / `ilike` do not.
 *
 *   ilike(business.name, `%${escapeLike(q)}%`)
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`)
}
