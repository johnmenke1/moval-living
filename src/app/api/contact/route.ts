import { NextResponse } from 'next/server'
import { verifyTurnstileOrSkip } from '@/lib/turnstile'

// GoHighLevel integration for contact form submissions
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessSlug, name, email, phone, message, turnstileToken } = body

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Turnstile verification — fails closed (no outbound webhook call) if invalid.
    // Skipped gracefully only when TURNSTILE_SECRET_KEY is unset (dev safety).
    const remoteIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const turnstile = await verifyTurnstileOrSkip(turnstileToken ?? '', remoteIp)
    if (!turnstile.ok) {
      return NextResponse.json(
        { error: 'Bot protection check failed — please try again.' },
        { status: 403 },
      )
    }

    const ghlWebhookUrl = process.env.GHL_WEBHOOK_URL
    if (ghlWebhookUrl) {
      await fetch(ghlWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'moval.living-directory',
          business: businessSlug,
          name: name.trim(),
          email: email.trim(),
          phone: phone?.trim() || '',
          message: message.trim(),
          timestamp: new Date().toISOString(),
        }),
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
