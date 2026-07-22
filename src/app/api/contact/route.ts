import { NextResponse } from 'next/server'

// GoHighLevel integration for contact form submissions
export async function POST(request: Request) {
  try {
    const { businessSlug, name, email, phone, message } = await request.json()

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
