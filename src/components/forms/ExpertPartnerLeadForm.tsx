'use client'

import { useState } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'

interface ExpertPartnerLeadFormProps {
  businessId: string
  businessName: string
}

export function ExpertPartnerLeadForm({
  businessId,
  businessName,
}: ExpertPartnerLeadFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  // Honeypot — bots fill this; humans never see it
  const [website, setWebsite] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/partners/${businessId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message, website }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not send your message. Please try again.')
        return
      }
      setSubmitted(true)
      setName('')
      setEmail('')
      setPhone('')
      setMessage('')
    } catch (err) {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white border border-[#007a7f] rounded-xl p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-[#007a7f] mx-auto mb-3" />
        <h3 className="text-xl font-bold text-[#1a2e35] mb-2">Message sent!</h3>
        <p className="text-[#5a6c72]">
          {businessName} will get back to you soon. They typically respond within one
          business day.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
    >
      <div>
        <h3 className="text-xl font-bold text-[#1a2e35]">Get in touch</h3>
        <p className="text-sm text-[#5a6c72] mt-1">
          Send {businessName} a message. They&apos;ll respond by email.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#1a2e35] mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-[#007a7f] focus:ring-1 focus:ring-[#007a7f] outline-none"
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1a2e35] mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-[#007a7f] focus:ring-1 focus:ring-[#007a7f] outline-none"
            maxLength={320}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1a2e35] mb-1">
          Phone <span className="text-[#5a6c72] font-normal">(optional)</span>
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-[#007a7f] focus:ring-1 focus:ring-[#007a7f] outline-none"
          maxLength={50}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1a2e35] mb-1">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-[#007a7f] focus:ring-1 focus:ring-[#007a7f] outline-none resize-y"
          maxLength={2000}
          placeholder="Tell us what you're looking for..."
        />
      </div>

      {/* Honeypot — visually hidden but accessible to bots */}
      <div className="absolute opacity-0 pointer-events-none -left-[9999px]" aria-hidden="true">
        <label>
          Website (leave blank)
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#007a7f] text-white font-semibold rounded-lg hover:bg-[#006a70] disabled:opacity-50 transition-colors"
      >
        <Send className="w-4 h-4" />
        {submitting ? 'Sending...' : 'Send Message'}
      </button>

      <p className="text-xs text-[#5a6c72] text-center">
        Your message goes directly to {businessName}. moval.living doesn&apos;t share your
        info with anyone else.
      </p>
    </form>
  )
}