import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, ArrowLeft, Building2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { JsonLd } from '@/components/seo/JsonLd'
import { renderMarkdown } from '@/lib/markdown'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

async function getPublishedPost(slug: string) {
  const post = await prisma.guestPost.findUnique({
    where: { slug },
    include: { author: true },
  })
  if (!post || post.status !== 'published' || !post.publishedAt) return null
  return post
}

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedPost(slug)
  if (!post) return { title: 'Not found' }

  const title = post.metaTitle ?? post.title
  const description = post.metaDescription ?? post.excerpt
  // /insights only serves GUEST posts; author is always present
  const authorName = post.author!.displayName
  const url = `https://www.moval.living/insights/${post.slug}`

  return {
    title,
    description,
    authors: [{ name: authorName }],
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      authors: [authorName],
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

export default async function InsightPostPage({ params }: Ctx) {
  const { slug } = await params
  const post = await getPublishedPost(slug)
  if (!post) notFound()

  const author = post.author
  // /insights only lists GUEST posts, which must have an author — but TypeScript
  // doesn't know that; guard defensively
  if (!author) notFound()

  const url = `https://www.moval.living/insights/${post.slug}`
  const authorUrl = `https://www.moval.living/authors/${author.slug}`

  // JSON-LD: Article with author as Person. This is what gives the byline
  // its SEO value — Google reads structured data, not just visible HTML.
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.heroImageUrl ? [post.heroImageUrl] : undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: {
      '@type': 'Person',
      name: author.displayName,
      url: authorUrl,
      ...(author.title ? { jobTitle: author.title } : {}),
      ...(author.companyName
        ? {
            worksFor: {
              '@type': 'Organization',
              name: author.companyName,
              url: author.companyUrl ?? undefined,
            },
          }
        : {}),
      ...(author.linkedinUrl
        ? { sameAs: [author.linkedinUrl, ...(author.twitterUrl ? [author.twitterUrl] : [])].filter(Boolean) }
        : author.twitterUrl
        ? { sameAs: [author.twitterUrl] }
        : {}),
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

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.displayName,
    url: authorUrl,
    ...(author.title ? { jobTitle: author.title } : {}),
    description: author.bio,
    image: author.photoUrl ?? undefined,
    ...(author.companyName
      ? {
          worksFor: {
            '@type': 'Organization',
            name: author.companyName,
            url: author.companyUrl ?? undefined,
          },
        }
      : {}),
    sameAs: [
      author.personalSiteUrl,
      author.companyUrl,
      author.linkedinUrl,
      author.twitterUrl,
      author.facebookUrl,
      author.instagramUrl,
    ].filter((x): x is string => Boolean(x)),
  }

  // FAQ JSON-LD — only when faqItems are present
  type FaqItem = { question: string; answer: string }
  const faqItems: FaqItem[] = Array.isArray(post.faqItems) ? post.faqItems as FaqItem[] : []
  const faqSchema = faqItems.length > 0 ? {
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
  } : null

  const html = renderMarkdown(post.body)

  return (
    <>
      <JsonLd schema={articleSchema} />
      <JsonLd schema={personSchema} />
      {faqSchema && <JsonLd schema={faqSchema} />}

      <article className="bg-background min-h-screen">
        {/* Back link */}
        <div className="container-max pt-8">
          <Link
            href="/insights"
            className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            All Insights
          </Link>
        </div>

        {/* Hero */}
        {post.heroImageUrl && (
          <div className="container-max mt-6">
            <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.heroImageUrl}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        <div className="container-max py-12">
          <div className="max-w-2xl mx-auto">
            {/* Title + meta */}
            <header className="mb-8">
              <h1 className="text-4xl sm:text-5xl font-bold text-text leading-tight mb-4">
                {post.title}
              </h1>
              <p className="text-lg text-text-secondary mb-6">{post.excerpt}</p>

              {/* Byline card */}
              <Link
                href={`/authors/${author.slug}`}
                className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:border-primary transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                  {author.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={author.photoUrl}
                      alt={author.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-semibold">
                      {author.displayName
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-text">{author.displayName}</div>
                  {author.title && (
                    <div className="text-sm text-text-secondary">{author.title}</div>
                  )}
                  {author.companyName && (
                    <div className="text-xs text-text-secondary inline-flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3" />
                      {author.companyName}
                    </div>
                  )}
                </div>
                <div className="text-xs text-text-secondary hidden sm:block">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {post.publishedAt && new Date(post.publishedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </Link>
            </header>

            {/* Body */}
            <div
              className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-text prose-p:text-text prose-a:text-primary hover:prose-a:underline prose-strong:text-text prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* FAQ section — visible on page, backed by FAQPage JSON-LD */}
            {faqItems.length > 0 && (
              <div className="mt-12 pt-8 border-t border-slate-200">
                <h2 className="text-2xl font-bold text-text mb-6">Frequently Asked Questions</h2>
                <div className="space-y-4">
                  {faqItems.map((item, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-xl p-5">
                      <h3 className="font-semibold text-text mb-2">{item.question}</h3>
                      <p className="text-text-secondary text-sm leading-relaxed">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer byline */}
            <footer className="mt-12 pt-8 border-t border-slate-200">
              <div className="text-sm text-text-secondary">
                Written by{' '}
                <Link href={`/authors/${author.slug}`} className="text-primary font-semibold hover:underline">
                  {author.displayName}
                </Link>
                {author.companyName && (
                  <>
                    {' '}
                    of{' '}
                    {author.companyUrl ? (
                      // rel="sponsored" because the relationship between
                      // MoVal Living and the partner business is paid.
                      <a
                        href={author.companyUrl}
                        rel="sponsored noopener"
                        target="_blank"
                        className="text-primary font-semibold hover:underline"
                      >
                        {author.companyName}
                      </a>
                    ) : (
                      <span className="font-semibold">{author.companyName}</span>
                    )}
                  </>
                )}
                . Published{' '}
                {post.publishedAt &&
                  new Date(post.publishedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                .
              </div>
              {author.bio && (
                <p className="mt-3 text-sm text-text-secondary italic">{author.bio}</p>
              )}
            </footer>
          </div>
        </div>
      </article>
    </>
  )
}