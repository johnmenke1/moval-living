import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import LifePostContent from './LifePostContent'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

async function getPublishedLifePost(slug: string) {
  const post = await prisma.guestPost.findUnique({ where: { slug } })
  if (!post || post.status !== 'published' || post.postType !== 'LIFE' || !post.publishedAt) return null
  return post
}

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedLifePost(slug)
  if (!post) return { title: 'Not found' }

  const title = post.metaTitle ?? post.title
  const description = post.metaDescription ?? post.excerpt
  const url = `https://www.moval.living/life/${post.slug}`

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

export default async function LifePostPage({ params }: Ctx) {
  const { slug } = await params
  const post = await getPublishedLifePost(slug)
  if (!post) notFound()

  return (
    <article className="bg-background min-h-screen">
      <div className="container-max pt-8">
        <Link
          href="/life"
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Life in MoVal
        </Link>
      </div>

      <LifePostContent post={post} />
    </article>
  )
}
