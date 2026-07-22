'use client'

import { useState } from 'react'
import { Send, CheckCircle } from 'lucide-react'

interface ContactBusinessFormProps {
  businessName: string
  businessSlug: string
}

export function ContactBusinessForm({ businessName, businessSlug }: ContactBusinessFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessSlug, name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim() }),
      })

      if (!res.ok) throw new Error('Failed to send message')
      setSuccess(true)
      setName('')
      setEmail('')
      setPhone('')
      setMessage('')
    } catch {
      setError('Something went wrong. Please try again or contact the business directly.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
        <h4 className="font-bold text-text mb-1">Message Sent!</h4>
        <p className="text-sm text-text-secondary">{businessName} will get back to you soon.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your Name *"
          className="input text-sm"
          required
        />
      </div>
      <div>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Your Email *"
          className="input text-sm"
          required
        />
      </div>
      <div>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          className="input text-sm"
        />
      </div>
      <div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="How can we help you? *"
          className="input text-sm min-h-[100px] resize-none"
          required
        />
      </div>
      {error && <p className="text-error text-xs">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="btn-primary w-full text-sm flex items-center justify-center gap-2"
      >
        {submitting ? 'Sending...' : 'Send Message'}
        <Send className="w-4 h-4" />
      </button>
    </form>
  )
}
