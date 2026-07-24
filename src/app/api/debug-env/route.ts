import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({
    AUTH_SECRET: process.env.AUTH_SECRET ? 'SET (' + process.env.AUTH_SECRET.length + ' chars)' : 'MISSING',
    AUTH_URL: process.env.AUTH_URL || 'MISSING',
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM || 'MISSING',
    AWS_SES_SMTP_HOST: process.env.AWS_SES_SMTP_HOST || 'MISSING',
    AWS_SES_SMTP_USERNAME: process.env.AWS_SES_SMTP_USERNAME ? 'SET' : 'MISSING',
    AWS_SES_SMTP_PASSWORD: process.env.AWS_SES_SMTP_PASSWORD ? 'SET' : 'MISSING',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'MISSING',
  })
}
