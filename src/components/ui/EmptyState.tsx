import Link from 'next/link'
import { ArrowRight, SearchX } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description: string
  ctaLabel?: string
  ctaHref?: string
}

export function EmptyState({ title, description, ctaLabel, ctaHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
        <SearchX className="w-10 h-10 text-slate-300" />
      </div>
      <h3 className="text-xl font-bold text-text mb-2">{title}</h3>
      <p className="text-text-secondary max-w-md mb-8 leading-relaxed">{description}</p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className="btn-primary inline-flex items-center gap-2">
          {ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}
