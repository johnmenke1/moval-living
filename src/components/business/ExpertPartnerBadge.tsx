import { Award, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPartnerDisplay } from '@/lib/expert-partner'

interface ExpertPartnerBadgeProps {
  business: {
    isExpertPartner: boolean
    foundingPartnerSince: Date | null
  }
  variant?: 'pill' | 'inline' | 'banner'
  className?: string
}

/**
 * Badge for Moreno Valley Expert Partner program.
 *
 * Variants:
 *   - pill: small chip suitable for listing cards
 *   - inline: small text label suitable for header/title rows
 *   - banner: large hero-style banner for /partners/[slug] profile
 *
 * Renders nothing if the business is not an Expert Partner — so it's
 * safe to drop into any component without conditional checks.
 */
export function ExpertPartnerBadge({
  business,
  variant = 'pill',
  className,
}: ExpertPartnerBadgeProps) {
  const display = getPartnerDisplay(business)
  if (!display) return null

  if (variant === 'pill') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border shadow-sm',
          display.badgeColorClass,
          className
        )}
      >
        {display.tier === 'FOUNDING' ? (
          <Sparkles className="w-3 h-3" />
        ) : (
          <Award className="w-3 h-3" />
        )}
        {display.tier === 'FOUNDING' ? 'Founding Expert Partner' : 'Expert Partner'}
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border',
          display.badgeColorClass,
          className
        )}
      >
        {display.tier === 'FOUNDING' ? (
          <Sparkles className="w-3 h-3" />
        ) : (
          <Award className="w-3 h-3" />
        )}
        {display.tier === 'FOUNDING' ? 'Founding Expert Partner' : 'Expert Partner'}
      </span>
    )
  }

  // banner — used on /partners/[slug]
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl border shadow-md',
        display.badgeColorClass,
        className
      )}
    >
      {display.tier === 'FOUNDING' ? (
        <Sparkles className="w-4 h-4" />
      ) : (
        <Award className="w-4 h-4" />
      )}
      <span>
        {display.tier === 'FOUNDING'
          ? 'Founding Expert Partner'
          : 'Moreno Valley Expert Partner'}
      </span>
    </div>
  )
}