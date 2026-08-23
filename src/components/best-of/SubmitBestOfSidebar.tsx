import { ClipboardList, Vote, Gavel, Trophy, Lightbulb, ShieldCheck } from 'lucide-react'

const STEPS = [
  {
    icon: ClipboardList,
    title: 'We read every nomination',
    description: 'Our team reviews your submission and groups it with similar community picks.',
  },
  {
    icon: Vote,
    title: 'Public voting opens',
    description: 'Finalists are shared with the community so neighbors can vote for their favorites.',
  },
  {
    icon: Gavel,
    title: 'Editors make the call',
    description: 'We weigh the vote, reputation, and community involvement before naming winners.',
  },
  {
    icon: Trophy,
    title: 'Winners are crowned',
    description: 'Selected businesses appear on the Best Of page and receive the Best Of badge.',
  },
]

const TIPS = [
  'Be specific — what makes them your go-to?',
  'Mention staff, quality, atmosphere, or community work.',
  'One business per nomination, please.',
]

export function SubmitBestOfSidebar() {
  return (
    <div className="space-y-6">
      {/* What happens next */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-lg font-bold text-text mb-5">What happens next</h3>
        <div className="space-y-5">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 my-1.5" />
                  )}
                </div>
                <div className="pb-2">
                  <p className="font-semibold text-text text-sm">{step.title}</p>
                  <p className="text-text-secondary text-sm mt-0.5 leading-relaxed">{step.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Nomination tips */}
      <div className="bg-gradient-to-br from-secondary/5 to-primary/5 rounded-2xl border border-primary/10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-text">Nomination tips</h3>
        </div>
        <ul className="space-y-3">
          {TIPS.map(tip => (
            <li key={tip} className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Independence note */}
      <div className="rounded-2xl border-l-4 border-accent bg-accent/5 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-text leading-relaxed">
            <strong className="text-secondary">Editorial independence.</strong>{' '}
            Featured or Expert Partner listings never influence Best Of selections.
            A business cannot buy its way onto this list.
          </p>
        </div>
      </div>
    </div>
  )
}
