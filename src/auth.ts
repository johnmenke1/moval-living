import NextAuth from 'next-auth'
import Nodemailer from 'next-auth/providers/nodemailer'

export const { handlers, signIn, signOut, auth } = NextAuth({
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
  trustHost: true,
})
