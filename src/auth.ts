import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import Nodemailer from 'next-auth/providers/nodemailer'

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://placeholder:***@127.0.0.1:5432/placeholder?sslmode=disable'
  const pool = new Pool({ connectionString })
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://placeholder:***@127.0.0.1:5432/placeholder?sslmode=disable',
  }),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST!,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER!,
          pass: process.env.EMAIL_SERVER_PASSWORD!,
        },
      },
      from: process.env.AUTH_EMAIL_FROM!,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = (user as { role?: string }).role }
      return token
    },
    async session({ session, token }) {
      if (session.user) { session.user.id = token.id as string; (session.user as { role?: string }).role = token.role as string }
      return session
    },
  },
  trustHost: true,
})
