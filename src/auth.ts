import NextAuth from 'next-auth'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Keep the provider on CommonJS loading: this project previously hit an ESM
// interop failure with the static provider import in the Vercel runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Nodemailer = (require('next-auth/providers/nodemailer') as typeof import('next-auth/providers/nodemailer')).default

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createAuthPrisma() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const authPrisma = globalForPrisma.prisma || createAuthPrisma()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = authPrisma

function toAuthUser(owner: {
  id: string
  email: string
  name: string | null
  emailVerified: Date | null
  image: string | null
  role: 'USER' | 'ADMIN'
}) {
  return {
    id: owner.id,
    email: owner.email,
    name: owner.name,
    emailVerified: owner.emailVerified,
    image: owner.image,
    role: owner.role,
  }
}

// Minimal custom adapter — implements the methods used by email magic links.
const emailAdapter = {
  async createUser({ name, email }: { name?: string | null; email: string }) {
    console.log('[adapter] createUser called:', { name, email })
    try {
      const existingOwner = await authPrisma.owner.findUnique({
        where: { email: email.toLowerCase() },
      })
      if (existingOwner) {
        console.log('[adapter] createUser: found existing owner:', existingOwner.id)
        return toAuthUser(existingOwner)
      }

      const owner = await authPrisma.owner.create({
        data: { name, email: email.toLowerCase() },
      })
      console.log('[adapter] createUser: created new owner:', owner.id)
      return toAuthUser(owner)
    } catch (err) {
      console.error('[adapter] createUser ERROR:', err)
      throw err
    }
  },
  async getUserByEmail(email: string) {
    console.log('[adapter] getUserByEmail called:', email)
    try {
      const owner = await authPrisma.owner.findUnique({
        where: { email: email.toLowerCase() },
      })
      console.log('[adapter] getUserByEmail result:', owner?.id ?? 'null')
      return owner ? toAuthUser(owner) : null
    } catch (err) {
      console.error('[adapter] getUserByEmail ERROR:', err)
      throw err
    }
  },
  async createVerificationToken({ identifier, token, expires }: { identifier: string; token: string; expires: Date }) {
    return authPrisma.verificationToken.create({
      data: { identifier: identifier.toLowerCase(), token, expires },
    })
  },
  async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
    const normalizedIdentifier = identifier.toLowerCase()
    const found = await authPrisma.verificationToken.findUnique({
      where: { identifier_token: { identifier: normalizedIdentifier, token } },
    })
    if (!found) return null
    await authPrisma.verificationToken.delete({
      where: { identifier_token: { identifier: normalizedIdentifier, token } },
    })
    return found
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: emailAdapter,
  providers: [
    Nodemailer({
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
      if (user?.id) token.id = user.id

      // Read the role from the database on each session refresh. This makes an
      // administrator promotion effective without baking an old USER role into
      // a long-lived JWT.
      const ownerId = typeof token.id === 'string' ? token.id : null
      const owner = ownerId
        ? await authPrisma.owner.findUnique({
            where: { id: ownerId },
            select: { role: true },
          })
        : null

      token.role = owner?.role || 'USER'
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
