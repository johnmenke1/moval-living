import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
// Share the one tuned pool (see src/db/index.ts). Do NOT build a second
// client/Pool here: a default-sized pool defeated the Neon connection tuning.
import { db, owner as ownerTable } from '@/db'

type MovalRole = 'USER' | 'ADMIN'

export const { handlers, signIn, signOut, auth } = NextAuth({
  // No adapter — Credentials + JWT strategy is all we need
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = String(credentials.email).toLowerCase().trim()
        const password = String(credentials.password)

        const owner = await db.query.owner.findFirst({ where: eq(ownerTable.email, email) })
        if (!owner || !owner.passwordHash) return null

        const valid = await bcrypt.compare(password, owner.passwordHash)
        if (!valid) return null

        return { id: owner.id, email: owner.email, name: owner.name, role: owner.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // The augmented User type already declares role as MovalRole, but
        // TS infers it as string in the JWT callback context. Cast to the
        // narrowed literal union so the assignment matches JWT.role.
        token.role = ((user as { role?: MovalRole }).role || 'USER') as MovalRole
      }

      // Refresh role from DB on each token refresh
      const ownerId = typeof token.id === 'string' ? token.id : null
      if (ownerId) {
        const owner = await db.query.owner.findFirst({
          where: eq(ownerTable.id, ownerId),
          columns: { role: true },
        })
        token.role = (owner?.role || 'USER') as MovalRole
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role === 'ADMIN' ? 'ADMIN' : 'USER'
      }
      return session
    },
  },
  trustHost: true,
})