import NextAuth from 'next-auth'
import Nodemailer from 'next-auth/providers/nodemailer'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Nodemailer({
      server: {
        host: process.env.AWS_SES_SMTP_HOST || 'email-smtp.us-west-1.amazonaws.com',
        port: 587,
        secure: false,
        requireTLS: true,
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
