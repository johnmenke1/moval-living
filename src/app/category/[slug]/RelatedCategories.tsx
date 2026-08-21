import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { getCategoryBySlug } from '@/data/categories'
import { getRelatedCategories } from '@/data/category-relations'

/**
 * Renders the 4 related categories for the current page. Server
 * component — used inside /category/[slug]/page.tsx.
 */
export function RelatedCategories({ currentSlug }: { currentSlug: string }) {
  const related = getRelatedCategories(currentSlug)
  if (related.length === 0) return null

  return (
    <section className="mt-16 pt-10 border-t border-slate-200">
      <h2 className="text-xl font-bold text-text mb-1">Related categories</h2>
      <p className="text-text-secondary text-sm mb-6">
        Other ways to browse Moreno Valley businesses.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {related.map(slug => {
          const cat = getCategoryBySlug(slug)
          if (!cat) return null
          return (
            <Link
              key={slug}
              href={`/category/${cat.slug}`}
              className="group flex items-start gap-3 bg-white rounded-xl border border-slate-200 p-4 hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text text-sm group-hover:text-primary transition-colors leading-tight">
                  {cat.name}
                </p>
                <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                  {cat.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="mt-6 text-sm text-text-secondary">
        Looking for something else?{' '}
        <Link href="/search" className="text-primary font-medium hover:underline">
          Browse all categories
        </Link>{' '}
        or{' '}
        <Link href="/submit" className="text-primary font-medium hover:underline">
          list your business
        </Link>
        .
      </div>
    </section>
  )
}
