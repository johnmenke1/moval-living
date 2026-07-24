import NextAuth from 'next-auth'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
// @ts-ignore
import nodemailer from 'nodemailer'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createAuthPrisma() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const authPrisma = globalForPrisma.prisma || createAuthPrisma()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = authPrisma

// Minimal custom adapter — only implements what email magic link needs
const emailAdapter = {
  async createUser({ name, email }: { name?: string | null; email: string }) {
    const owner = await authPrisma.owner.create({
      data: { name, email },
    })
    return { id: owner.id, email: owner.email, name: owner.name, emailVerified: null, image: null }
  },
  async getUserByEmail(email: string) {
    const owner = await authPrisma.owner.findUnique({ where: { email } })
    if (!owner) return null
    return { id: owner.id, email: owner.email, name: owner.name, emailVerified: owner.emailVerified, image: owner.image }
  },
  async createVerificationToken({ identifier, token, expires }: { identifier: string; token: string; expires: Date }) {
    return authPrisma.verificationToken.create({
      data: { identifier, token, expires },
    })
  },
  async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
    const found = await authPrisma.verificationToken.findUnique({
      where: { identifier_token: { identifier, token } },
    })
    if (!found) return null
    await authPrisma.verificationToken.delete({
      where: { identifier_token: { identifier, token } },
    })
    return found
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: emailAdapter,
  providers: [
    // Using require() to avoid ESM import issues with nodemailer in Next.js
    (require('next-auth/providers/nodemailer') as any).default({
      server: {
        host: process.env.AWS_SES_SMTP_HOST,
        port: 587,
        secure: false,
        auth: {
          user: process.env.AWS_SES_SMTP_USERNAME,
          pass: process.env.AWS_SES_SMTP_PASSWORD,
        },
      },
      from: process.env.AUTH_EMAIL_FROM || 'noreply@moval.living',
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
