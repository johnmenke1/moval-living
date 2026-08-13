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

interface LifeAuthor {
  slug: string
  displayName: string
  title: string | null
  companyName: string | null
  photoUrl: string | null
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
  publishedAt: string | null
  author: LifeAuthor | null
}

export default function LifePostContent({ post }: { post: LifePost }) {
  const hasSpotify = post.spotifyTrack1 || post.spotifyTrack2

  return (
    <div>
      {/* Article body — top padding lives here so it sits cleanly below the
          "Life in MoVal" back-link band. The flex layout puts the article
          next to the Spotify sidebar on desktop. */}
      <div className="container-max pt-12">
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
              className="prose prose-base max-w-none prose-headings:font-bold prose-headings:text-text prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2 prose-p:text-text prose-p:my-3 prose-a:text-primary hover:prose-a:underline prose-strong:font-bold prose-strong:text-text prose-img:rounded-xl prose-blockquote:border-l-4 prose-blockquote:border-l-primary prose-blockquote:text-text-secondary prose-blockquote:pl-4 prose-blockquote:my-4 prose-ul:my-3 prose-ol:my-3 prose-li:my-1"
              dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
            />
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

      {/* Byline — pulled out of the article body into its own band so it
          has its own clear vertical rhythm:
            - mt-20 (80px above the byline border, separates from article body)
            - pt-8 (32px padding above the byline content, after the border)
            - pb-24 (96px below the byline, separates from site footer)
          This was previously crammed inside py-20 padding that the article
          body shared with the byline, making the byline feel like it sat
          below the article margin instead of in its own band. */}
      <footer className="container-max mt-20 pb-24">
        <div className="max-w-2xl">
          <div className="pt-8 border-t border-slate-200">
            <div className="flex items-center gap-4">
              {post.author ? (
                <Link
                  href={`/authors/${post.author.slug}`}
                  className="flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-full bg-primary overflow-hidden flex-shrink-0">
                    {post.author.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.author.photoUrl}
                        alt={post.author.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                        {post.author.displayName
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-text group-hover:text-primary transition-colors">
                      {post.author.displayName}
                    </div>
                    {post.author.title && (
                      <div className="text-sm text-text-secondary">
                        {post.author.title}
                      </div>
                    )}
                  </div>
                </Link>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                    JM
                  </div>
                  <div>
                    <div className="font-semibold text-text">John Menke</div>
                    <div className="text-sm text-text-secondary">
                      eXP of California Realty · Moreno Valley
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}