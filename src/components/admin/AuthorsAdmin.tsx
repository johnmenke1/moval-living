'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Search, X, ExternalLink, FileText, Loader2 } from 'lucide-react'

interface Author {
  id: string
  slug: string
  displayName: string
  title: string | null
  companyName: string | null
  photoUrl: string | null
  isActive: boolean
  postsThisPeriod: number
  lastPostedAt: string | null
  createdAt: string | Date
  _count: { posts: number }
}

interface Props {
  initialAuthors: Author[]
}

export default function AuthorsAdmin({ initialAuthors }: Props) {
  const router = useRouter()
  const [authors, setAuthors] = useState<Author[]>(initialAuthors)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return authors
    const q = search.toLowerCase()
    return authors.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        (a.title ?? '').toLowerCase().includes(q) ||
        (a.companyName ?? '').toLowerCase().includes(q)
    )
  }, [authors, search])

  async function handleDelete(author: Author) {
    if (!confirm(`Disable ${author.displayName}? Their posts will remain visible but the author profile will be hidden from new author-page hubs.`)) {
      return
    }
    setLoading(author.id)
    try {
      const res = await fetch(`/api/admin/authors/${author.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      const json = await res.json()
      setAuthors((prev) =>
        prev.map((a) => (a.id === author.id ? { ...a, isActive: !json.soft } : a))
      )
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, title, or company"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="text-sm text-text-secondary">
          {filtered.length} of {authors.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center text-text-secondary">
          {authors.length === 0
            ? 'No guest authors yet. Add your first one to start publishing.'
            : 'No authors match your search.'}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map((author) => (
            <div
              key={author.id}
              className={`p-4 flex items-start gap-4 ${!author.isActive ? 'opacity-60' : ''}`}
            >
              {/* Photo */}
              <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                {author.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={author.photoUrl}
                    alt={author.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-semibold">
                    {author.displayName
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text">
                    {author.displayName}
                  </span>
                  {!author.isActive && (
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                      Disabled
                    </span>
                  )}
                </div>
                {author.title && (
                  <div className="text-sm text-text-secondary">{author.title}</div>
                )}
                {author.companyName && (
                  <div className="text-sm text-text-secondary">
                    {author.companyName}
                  </div>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {author._count.posts} {author._count.posts === 1 ? 'post' : 'posts'}
                  </span>
                  <span>
                    {author.postsThisPeriod}/1 this month
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Link
                  href={`/authors/${author.slug}`}
                  target="_blank"
                  className="p-2 text-text-secondary hover:text-primary"
                  title="View public page"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
                <Link
                  href={`/dashboard/authors/${author.slug}`}
                  className="p-2 text-text-secondary hover:text-primary"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => handleDelete(author)}
                  disabled={loading === author.id}
                  className="p-2 text-text-secondary hover:text-error disabled:opacity-50"
                  title="Disable"
                >
                  {loading === author.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}