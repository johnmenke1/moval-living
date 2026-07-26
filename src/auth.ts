import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrisma() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const prisma = globalForPrisma.prisma || createPrisma()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

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
        console.log('[auth] authorize called, email:', credentials?.email)
        if (!credentials?.email || !credentials?.password) {
          console.log('[auth] missing credentials')
          return null
        }

        const email = String(credentials.email).toLowerCase().trim()
        const password = String(credentials.password)

        console.log('[auth] looking up:', email)
        const owner = await prisma.owner.findUnique({ where: { email } })
        console.log('[auth] owner found:', !!owner, owner ? 'id=' + owner.id : '')
        if (!owner || !owner.passwordHash) {
          console.log('[auth] no owner or no password hash')
          return null
        }

        const valid = await bcrypt.compare(password, owner.passwordHash)
        console.log('[auth] password valid:', valid)
        if (!valid) return null

        const result = { id: owner.id, email: owner.email, name: owner.name, role: owner.role }
        console.log('[auth] returning:', JSON.stringify(result))
        return result
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role || 'USER'
      }

      // Refresh role from DB on each token refresh
      const ownerId = typeof token.id === 'string' ? token.id : null
      if (ownerId) {
        const owner = await prisma.owner.findUnique({
          where: { id: ownerId },
          select: { role: true },
        })
        token.role = owner?.role || 'USER'
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
