import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'
import { JsonLd } from '@/components/seo/JsonLd'
import LifePostContent from './LifePostContent'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

async function getPublishedLifePost(slug: string) {
  // Full author select — the Article + Person JSON-LD blocks need every
  // social URL + bio + photo, not just the visible byline fields.
  // Mirrors the shape insights/[slug]/page.tsx queries for the same
  // schema. UI consumers (LifePostContent) ignore the extras.
  const post = await prisma.guestPost.findUnique({
    where: { slug },
    include: {
      author: {
        select: {
          slug: true,
          displayName: true,
          title: true,
          companyName: true,
          companyUrl: true,
          personalSiteUrl: true,
          linkedinUrl: true,
          twitterUrl: true,
          facebookUrl: true,
          instagramUrl: true,
          bio: true,
          photoUrl: true,
        },
      },
    },
  })
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

  // Render markdown to HTML on the server so the prose is part of the
  // initial paint (the previous client-side renderMarkdown in a useEffect
  // showed an empty container until hydration completed).
  const bodyHtml = renderMarkdown(post.body)

  const url = `https://www.moval.living/life/${post.slug}`

  // JSON-LD: Article with author. When the post has an author, the
  // author is a Person (the E-E-A-T signal we want for AI crawlers).
  // When there's no author, fall back to the Organization — the schema
  // stays valid and the article still gets indexed. The standalone
  // Person block is only emitted when a real author exists.
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.heroImageUrl ? [post.heroImageUrl] : undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: post.author
      ? {
          '@type': 'Person',
          name: post.author.displayName,
          url: `https://www.moval.living/authors/${post.author.slug}`,
          ...(post.author.title ? { jobTitle: post.author.title } : {}),
          ...(post.author.companyName
            ? {
                worksFor: {
                  '@type': 'Organization',
                  name: post.author.companyName,
                  url: post.author.companyUrl ?? undefined,
                },
              }
            : {}),
          ...(post.author.linkedinUrl
            ? {
                sameAs: [
                  post.author.linkedinUrl,
                  ...(post.author.twitterUrl ? [post.author.twitterUrl] : []),
                ].filter(Boolean),
              }
            : post.author.twitterUrl
              ? { sameAs: [post.author.twitterUrl] }
              : {}),
        }
      : {
          '@type': 'Organization',
          name: 'MoVal Living',
          url: 'https://www.moval.living',
        },
    publisher: {
      '@type': 'Organization',
      name: 'MoVal Living',
      url: 'https://www.moval.living',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.moval.living/logo.png',
      },
    },
  }

  const personSchema = post.author
    ? {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: post.author.displayName,
        url: `https://www.moval.living/authors/${post.author.slug}`,
        ...(post.author.title ? { jobTitle: post.author.title } : {}),
        description: post.author.bio,
        image: post.author.photoUrl ?? undefined,
        ...(post.author.companyName
          ? {
              worksFor: {
                '@type': 'Organization',
                name: post.author.companyName,
                url: post.author.companyUrl ?? undefined,
              },
            }
          : {}),
        sameAs: [
          post.author.personalSiteUrl,
          post.author.companyUrl,
          post.author.linkedinUrl,
          post.author.twitterUrl,
          post.author.facebookUrl,
          post.author.instagramUrl,
        ].filter((x): x is string => Boolean(x)),
      }
    : null

  // FAQ JSON-LD — only when faqItems are present
  type FaqItem = { question: string; answer: string }
  const faqItems: FaqItem[] = Array.isArray(post.faqItems) ? (post.faqItems as FaqItem[]) : []
  const faqSchema = faqItems.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      }
    : null

  return (
    <>
      <JsonLd schema={articleSchema} />
      {personSchema && <JsonLd schema={personSchema} />}
      {faqSchema && <JsonLd schema={faqSchema} />}

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

        <LifePostContent
          post={{
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            bodyHtml,
            heroImageUrl: post.heroImageUrl,
            metaTitle: post.metaTitle,
            metaDescription: post.metaDescription,
            spotifyTrack1: post.spotifyTrack1,
            spotifyTrack2: post.spotifyTrack2,
            publishedAt: post.publishedAt?.toISOString() ?? null,
            author: post.author
              ? {
                  slug: post.author.slug,
                  displayName: post.author.displayName,
                  title: post.author.title,
                  companyName: post.author.companyName,
                  photoUrl: post.author.photoUrl,
                }
              : null,
          }}
        />
      </article>
    </>
  )
}
