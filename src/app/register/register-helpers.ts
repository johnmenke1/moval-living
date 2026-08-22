/**
 * Register page helpers — pure functions for the public /register form.
 * Lives outside the page component so unit tests can import without
 * pulling in React + NextAuth client libs.
 */

import { z } from 'zod'

/**
 * Form validation for the public register flow. Distinct from the
 * existing /api/auth/register which accepts extra claim-flow fields
 * (claimToken, seHablaEspanol) — those are for the business-claim
 * path, not public voting signup.
 */
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
  name: z.string().trim().min(1, 'Tell us what to call you').max(120),
  emailOptIn: z.boolean().optional().default(false),
})

export type RegisterInput = z.infer<typeof registerSchema>

/**
 * Build the /register URL with an optional returnTo param. Used by
 * VoteButton to redirect anonymous users to the registration page
 * with their destination preserved.
 */
export function buildRegisterUrl(returnTo: string | null | undefined): string {
  if (!returnTo) return '/register'
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/register'
  const params = new URLSearchParams({ returnTo })
  return `/register?${params.toString()}`
}
