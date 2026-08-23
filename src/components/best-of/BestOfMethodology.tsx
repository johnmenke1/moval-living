import { Users, Vote, ClipboardCheck, BadgeCheck } from 'lucide-react'

const STEPS = [
  {
    icon: Users,
    title: 'Community nominations',
    description:
      'Anyone can nominate a MoVal business they love. We read every submission and group them into categories that reflect what locals actually care about.',
  },
  {
    icon: Vote,
    title: 'Public voting',
    description:
      'Finalists are opened to the community for live voting. The businesses with the strongest neighborhood support rise to the top.',
  },
  {
    icon: ClipboardCheck,
    title: 'Editor review',
    description:
      'Our editors validate each contender — checking reputation, consistency, and especially how actively the business supports the Moreno Valley community.',
  },
  {
    icon: BadgeCheck,
    title: 'Winners crowned',
    description:
      'The final Best Of list balances public vote results with editorial judgment. Winners earn the badge because locals and editors agree they stand out.',
  },
]

export function BestOfMethodology() {
  return (
    <section id="methodology" className="py-16 md:py-20 bg-white">
      <div className="container-max">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-text mb-3">How winners are chosen</h2>
          <p className="text-text-secondary text-lg">
            A transparent mix of community voice and local editorial judgment.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            return (
              <div
                key={step.title}
                className="relative rounded-2xl border border-slate-100 bg-slate-50 p-6 hover:shadow-md transition-shadow"
              >
                <span className="absolute top-4 right-4 text-sm font-bold text-slate-200">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-text mb-2">{step.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{step.description}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-10 rounded-2xl border-l-4 border-accent bg-accent/5 p-6 md:p-8">
          <p className="text-text leading-relaxed">
            <strong className="text-secondary">Editorial independence.</strong>{' '}
            Featured or Expert Partner listings never influence Best Of selections.
            A business cannot buy its way onto this list. What matters is community support,
            quality, and genuine involvement in Moreno Valley.
          </p>
        </div>
      </div>
    </section>
  )
}
