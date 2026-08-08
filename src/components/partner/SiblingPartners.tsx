import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'

/**
 * SiblingPartners — "Other MoVal Experts" cross-promotion widget.
 *
 * Shows 2-4 other Expert Partners from different categories so visitors
 * on partner A's page see partners B/C/D too. Drives free cross-traffic
 * between all paid partners. Hidden for non-Founding partners of the
 * first wave when there are < 2 siblings (not enough variety yet).
 */
interface SiblingPartner {
  id: string
  name: string
  slug: string
  expertPartnerSlug: string | null
  tagline: string | null
  logo: string | null
  isExpertPartner: boolean
  foundingPartnerSince: Date | null
  category?: { name: string } | null
}

export function SiblingPartners({ partners }: { partners: SiblingPartner[] }) {
  if (partners.length === 0) return null

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-[#007a7f]" />
        <h2 className="text-base font-bold text-[#1a2e35]">Other MoVal Experts</h2>
      </div>
      <p className="text-xs text-[#5a6c72] mb-4">
        Verified Expert Partners across Moreno Valley — one per category.
      </p>
      <div className="space-y-3">
        {partners.map((p) => {
          const slug = p.expertPartnerSlug || p.slug
          const isFounding = !!p.foundingPartnerSince
          return (
            <Link
              key={p.id}
              href={`/partners/${slug}`}
              className="flex items-start gap-3 p-3 -mx-3 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              {p.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logo}
                  alt={`${p.name} logo`}
                  className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200 flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#007a7f]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-[#007a7f]">{p.name[0]}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-semibold text-sm text-[#1a2e35] group-hover:text-[#007a7f] transition-colors truncate">
                    {p.name}
                  </span>
                  {isFounding && (
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex-shrink-0"
                      title="Founding Partner"
                    >
                      ★
                    </span>
                  )}
                </div>
                {p.category?.name && (
                  <p className="text-xs text-[#5a6c72]">{p.category.name}</p>
                )}
                {p.tagline && (
                  <p className="text-xs text-[#5a6c72] mt-0.5 line-clamp-1">{p.tagline}</p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
      <Link
        href="/partners"
        className="flex items-center justify-center gap-1 mt-4 text-xs font-semibold text-[#007a7f] hover:underline"
      >
        See all MoVal Experts <ArrowRight className="w-3 h-3" />
      </Link>
    </section>
  )
}