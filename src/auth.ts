import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import Nodemailer from 'next-auth/providers/nodemailer'

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://placeholder:***@127.0.0.1:5432/placeholder?sslmode=disable',
  ssl: { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: {
        host: process.env.AWS_SES_SMTP_HOST || 'email-smtp.us-west-1.amazonaws.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.AWS_SES_ACCESS_KEY_ID,
          pass: process.env.AWS_SES_SMTP_PASSWORD,
        },
        tls: { rejectUnauthorized: false },
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
