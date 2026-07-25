import { createHash } from 'crypto'

export function safeCallbackPath(value: unknown): string {
  if (typeof value !== 'string') return '/dashboard'
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard'
  return value
}

// Auth.js email tokens are stored as SHA-256(`${token}${AUTH_SECRET}`) and the
// callback computes the same lookup key before calling useVerificationToken.
export function hashMagicLinkToken(token: string, secret: string): string {
  return createHash('sha256').update(`${token}${secret}`).digest('hex')
}
