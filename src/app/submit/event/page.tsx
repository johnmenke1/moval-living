import SubmitEventForm from '@/components/events/SubmitEventForm'

export const metadata = {
  title: 'Submit an Event — moval.living',
  description:
    'Share a community event for Moreno Valley and the surrounding area. We review every submission personally.',
}

export default function SubmitEventPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background, #f0efeb)' }}>
      <div className="container-max py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary, #1a2e35)' }}>
            Submit an Event
          </h1>
          <p style={{ color: 'var(--text-secondary, #5a6c72)' }}>
            Know something happening in or around Moreno Valley? Share it here and we&apos;ll add
            it to the community calendar after a quick review.
          </p>
        </div>

        {/* Info card */}
        <div
          className="mb-8 p-4 rounded-xl border border-slate-200 flex items-start gap-3"
          style={{ background: 'var(--surface, #fff)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'var(--primary, #007a7f)', opacity: 0.1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #007a7f)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary, #1a2e35)' }}>
              Local events in and around Moreno Valley
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary, #5a6c72)' }}>
              Moreno Valley, Riverside (Fox, Municipal Auditorium, UCR, CBU), Redlands Bowl, Beaumont,
              and Perris. We curate the regional mix in our weekly review — submit anything you
              think MoVal residents would want to know about.
            </p>
          </div>
        </div>

        {/* Form */}
        <div
          className="max-w-2xl"
          style={{
            background: 'var(--surface, #fff)',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px',
          }}
        >
          <SubmitEventForm />
        </div>
      </div>
    </div>
  )
}
