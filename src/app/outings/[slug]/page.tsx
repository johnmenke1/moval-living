import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

async function getPublishedOuting(slug: string) {
  const post = await prisma.guestPost.findUnique({ where: { slug } })
  if (!post || post.status !== 'published' || post.postType !== 'OUTING' || !post.publishedAt) return null
  return post
}

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedOuting(slug)
  if (!post) return { title: 'Not found' }

  const title = post.metaTitle ?? post.title
  const description = post.metaDescription ?? post.excerpt
  const url = `https://www.moval.living/outings/${post.slug}`

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      publishedTime: post.publishedAt?.toISOString(),
      images: post.heroImageUrl ? [post.heroImageUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: post.heroImageUrl ? [post.heroImageUrl] : undefined,
    },
    alternates: { canonical: url },
  }
}

export default async function OutingPostPage({ params }: Ctx) {
  const { slug } = await params
  const post = await getPublishedOuting(slug)
  if (!post) notFound()

  const html = renderMarkdown(post.body)
  // outingPhotos is stored as jsonb (array of { url, caption }) or null
  const outingPhotosArray: { url: string; caption?: string }[] = Array.isArray(post.outingPhotos)
    ? (post.outingPhotos as { url: string; caption?: string }[]).filter(
        (p): p is { url: string; caption?: string } =>
          typeof p?.url === 'string' && p.url !== ''
      )
    : [] 

  return (
    <article className="bg-background min-h-screen">
      <div className="container-max pt-8">
        <Link
          href="/outings"
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Live Curiously
        </Link>
      </div>

      <div className="container-max py-12">
        <div className="max-w-2xl mx-auto">
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

          {/* YouTube embed — shown if youtubeVideoId is set */}
          {post.youtubeVideoId && (
            <div className="mb-10">
              <div className="aspect-video rounded-2xl overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${post.youtubeVideoId}`}
                  title={post.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  className="w-full h-full"
                />
              </div>
            </div>
          )}

          <header className="mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-text leading-tight mb-4">
              {post.title}
            </h1>
            <p className="text-lg text-text-secondary">{post.excerpt}</p>
            {post.publishedAt && (
              <div className="flex items-center gap-1 text-sm text-text-secondary mt-3">
                <Calendar className="w-4 h-4" />
                {new Date(post.publishedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            )}
          </header>

          <div
            className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-text prose-headings:mt-8 prose-headings:mb-4 prose-p:text-text prose-p:my-4 prose-a:text-primary hover:prose-a:underline prose-strong:text-text prose-img:rounded-xl prose-blockquote:border-l-primary prose-blockquote:text-text-secondary prose-ul:my-4 prose-ol:my-4 prose-li:my-1"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* Photo gallery — shown if outingPhotos are set */}
          {outingPhotosArray.length > 0 && (
            <div className="mt-12 pt-8 border-t border-slate-200">
              <h2 className="text-2xl font-bold text-text mb-6">Trip Photos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {outingPhotosArray.map((photo, i) => (
                  <figure key={i} className="space-y-2">
                    <div className="aspect-square rounded-xl overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption || `${post.title} — photo ${i + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    {photo.caption && (
                      <figcaption className="text-sm text-text-secondary italic text-center px-1">
                        {photo.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          )}

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
      </div>
    </article>
  )
}
