import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

async function getPublishedSpotlight(slug: string) {
  const post = await prisma.guestPost.findUnique({
    where: { slug },
    include: { author: true },
  })
  if (!post || post.status !== 'published' || post.postType !== 'SPOTLIGHT' || !post.publishedAt) return null
  return post
}

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedSpotlight(slug)
  if (!post) return { title: 'Not found' }

  const title = post.metaTitle ?? post.title
  const description = post.metaDescription ?? post.excerpt
  const url = `https://www.moval.living/spotlights/${post.slug}`

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

export default async function SpotlightPostPage({ params }: Ctx) {
  const { slug } = await params
  const post = await getPublishedSpotlight(slug)
  if (!post) notFound()

  const html = renderMarkdown(post.body)
  const author = post.author

  return (
    <article className="bg-background min-h-screen">
      <div className="container-max pt-8">
        <Link
          href="/spotlights"
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Business Spotlights
        </Link>
      </div>

      <div className="container-max py-12">
        <div className="max-w-2xl mx-auto">
          {post.heroImageUrl && (
            <div className="aspect-video overflow-hidden rounded-2xl bg-slate-100 mb-10">
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
            className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-text prose-p:text-text prose-a:text-primary hover:prose-a:underline prose-strong:text-text prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {author && (
            <footer className="mt-12 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden">
                  {author.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={author.photoUrl}
                      alt={author.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-lg">
                      {author.displayName.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-text">{author.displayName}</div>
                  {author.title && <div className="text-sm text-text-secondary">{author.title}</div>}
                </div>
              </div>
            </footer>
          )}
        </div>
      </div>
    </article>
  )
}
