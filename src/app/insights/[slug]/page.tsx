import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { JsonLd } from '@/components/seo/JsonLd'
import { renderMarkdown } from '@/lib/markdown'
import AuthorByline from '@/components/author/AuthorByline'

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

        <div className="container-max pt-12 pb-12">
          <div className="max-w-2xl mx-auto">
            {/* Title + meta */}
            <header className="mb-8">
              <h1 className="text-4xl sm:text-5xl font-bold text-text leading-tight mb-4">
                {post.title}
              </h1>
              <p className="text-lg text-text-secondary mb-6">{post.excerpt}</p>

              {/* Byline card — uses the shared AuthorByline component so
                  the header structure stays in sync with /life posts. */}
              <AuthorByline
                author={{
                  slug: author.slug,
                  displayName: author.displayName,
                  title: author.title,
                  companyName: author.companyName,
                  photoUrl: author.photoUrl,
                }}
                publishedAt={post.publishedAt}
              />
            </header>

            {/* Body */}
            <div
              className="prose prose-base max-w-none prose-headings:font-bold prose-headings:text-text prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2 prose-p:text-text prose-p:my-3 prose-a:text-primary hover:prose-a:underline prose-strong:font-bold prose-strong:text-text prose-img:rounded-xl prose-blockquote:border-l-4 prose-blockquote:border-l-primary prose-blockquote:text-text-secondary prose-blockquote:pl-4 prose-blockquote:my-4 prose-ul:my-3 prose-ol:my-3 prose-li:my-1"
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
          </div>
        </div>
      </article>

      {/* Footer byline — extracted to its own band below the article, mirroring
          /life's layout. Same AuthorByline variant=footer (compact text-only
          byline) so both lanes use the same component for the same purpose. */}
      <footer className="container-max mt-12">
        <div className="max-w-2xl">
          <div className="border-t border-slate-200 pt-8 mb-24">
            <AuthorByline
              author={{
                slug: author.slug,
                displayName: author.displayName,
                title: author.title,
                companyName: author.companyName,
                photoUrl: author.photoUrl,
              }}
              publishedAt={post.publishedAt}
              variant="footer"
            />
          </div>
        </div>
      </footer>
    </>
  )
}