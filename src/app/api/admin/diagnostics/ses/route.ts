import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import nodemailer from 'nodemailer'

/**
 * POST /api/admin/diagnostics/ses
 *
 * Admin-only diagnostic endpoint. Attempts a real SMTP login with the
 * AWS_SES_SMTP_* env vars and reports what happened. Doesn't actually
 * send an email — just verifies auth.
 *
 * Returns:
 *   { ok: true,  diagnostic: { host, user, passLen, port, message } } on success
 *   { ok: false, error, code, response } on failure
 */
export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host = process.env.AWS_SES_SMTP_HOST
  const user = process.env.AWS_SES_SMTP_USERNAME
  const pass = process.env.AWS_SES_SMTP_PASSWORD
  const port = 587

  const diagnostic = {
    host: host || null,
    user: user || null,
    userPrefix: user ? user.slice(0, 4) : null,
    userSuffix: user ? user.slice(-4) : null,
    userLen: user?.length ?? 0,
    passLen: pass?.length ?? 0,
    passIsArn: pass?.startsWith('arn:aws:') ?? false,
    passStartsWithInp: pass?.startsWith('inp-') ?? false,
    passHasSpaces: pass?.includes(' ') ?? false,
    port,
  }

  if (!host || !user || !pass) {
    return NextResponse.json({
      ok: false,
      error: 'One or more SES env vars are missing',
      diagnostic,
    })
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  })

  try {
    await transporter.verify()
    return NextResponse.json({
      ok: true,
      diagnostic,
      message: 'SMTP verify succeeded — creds work',
    })
  } catch (err) {
    const e = err as Error & {
      code?: string
      response?: string
      responseCode?: number
    }
    return NextResponse.json({
      ok: false,
      error: e.message,
      code: e.code,
      response: e.response,
      responseCode: e.responseCode,
      diagnostic,
      hint: e.code === 'EAUTH'
        ? '535 means SMTP auth failed. The username is correct (inp-...) but the password is wrong. For SES Mail Manager, the password is the SMTP password shown when you created the ingress endpoint — NOT the AWS Secret Access Key, NOT a Secrets Manager ARN. If you lost it, rotate the SMTP password on the ingress endpoint in AWS Console.'
        : 'Connection or DNS issue — check host/port/firewall',
    })
  }
}