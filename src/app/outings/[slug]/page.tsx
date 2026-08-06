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
