import NextAuth from 'next-auth'
import Nodemailer from 'next-auth/providers/nodemailer'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createAuthPrisma() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const authPrisma = globalForPrisma.prisma || createAuthPrisma()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = authPrisma

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(authPrisma),
  providers: [
    Nodemailer({
      server: {
        host: process.env.AWS_SES_SMTP_HOST || 'smtp://localhost',
        port: 587,
        secure: false,
        auth: {
          user: process.env.AWS_SES_SMTP_USERNAME,
          pass: process.env.AWS_SES_SMTP_PASSWORD,
        },
      },
      from: process.env.AUTH_EMAIL_FROM || 'noreply@example.com',
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id as string; token.role = (user as { role?: string }).role }
      return token
    },
    async session({ session, token }) {
      if (session.user) { session.user.id = token.id as string; (session.user as { role?: string }).role = token.role as string }
      return session
    },
  },
  trustHost: true,
})
