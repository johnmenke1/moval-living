import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { renderMarkdown } from '@/lib/markdown'

function SpotifyPlayer({ trackId }: { trackId: string }) {
  return (
    <iframe
      src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator`}
      width="100%"
      height="152"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      className="rounded-lg"
    />
  )
}

interface LifePost {
  slug: string
  title: string
  excerpt: string
  bodyHtml: string
  heroImageUrl: string | null
  metaTitle: string | null
  metaDescription: string | null
  spotifyTrack1: string | null
  spotifyTrack2: string | null
}

export default function LifePostContent({ post }: { post: LifePost }) {
  const hasSpotify = post.spotifyTrack1 || post.spotifyTrack2

  return (
    <div className="container-max py-12">
      <div className="flex gap-12">
        {/* Main content */}
        <div className="flex-1 min-w-0 max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-text leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-lg text-text-secondary mb-8">{post.excerpt}</p>

          {post.heroImageUrl && (
            <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100 mb-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.heroImageUrl}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div
            className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-text prose-headings:mt-8 prose-headings:mb-4 prose-p:text-text prose-p:my-4 prose-a:text-primary hover:prose-a:underline prose-strong:text-text prose-img:rounded-xl prose-blockquote:border-l-primary prose-blockquote:text-text-secondary prose-ul:my-4 prose-ol:my-4 prose-li:my-1"
            dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
          />

          {/* Footer */}
          <footer className="mt-12 pt-8 border-t border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                JM
              </div>
              <div>
                <div className="font-semibold text-text">John Menke</div>
                <div className="text-sm text-text-secondary">
                  eXP of California Realty · Moreno Valley
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* Sidebar: music — sticky on desktop */}
        {hasSpotify && (
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-8">
              <h3 className="text-sm font-bold text-text uppercase tracking-wide mb-4">
                What I&apos;m listening to
              </h3>
              <div className="space-y-4">
                {post.spotifyTrack1 && <SpotifyPlayer trackId={post.spotifyTrack1} />}
                {post.spotifyTrack2 && <SpotifyPlayer trackId={post.spotifyTrack2} />}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}