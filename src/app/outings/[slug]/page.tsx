import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Calendar } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'
import { JsonLd } from '@/components/seo/JsonLd'
import OutingPhotoGallery from './OutingPhotoGallery'
import OutingByline from './OutingByline'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

async function getPublishedOuting(slug: string) {
  // Full author select — the Article + Person JSON-LD blocks need every
  // social URL + bio + photo. Mirrors life/[slug]/page.tsx and
  // insights/[slug]/page.tsx for the same schema.
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
  const outingPhotosArray = Array.isArray(post.outingPhotos)
    ? (post.outingPhotos as { url: string; caption?: string }[]).filter(
        (p): p is { url: string; caption?: string } =>
          typeof p?.url === 'string' && p.url !== ''
      )
    : []

  const url = `https://www.moval.living/outings/${post.slug}`

  // JSON-LD: Article with author. Falls back to Organization author when
  // the post has no author (the page UI handles null author for
  // OutingByline; the schema mirrors the same shape).
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
            href="/outings"
            className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            Live Curiously
          </Link>
        </div>

        <div className="container-max pt-8 pb-12">
          <div className="max-w-3xl mx-auto">
            {/* Hero — photo-led. Image fills the top of the article; title
                overlays the bottom-left so the photo IS the entry into the
                piece (this is a photo essay, after all). */}
            {post.heroImageUrl && (
              <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100 mb-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.heroImageUrl}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 sm:p-8">
                  <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight mb-2">
                    {post.title}
                  </h1>
                  {post.publishedAt && (
                    <div className="flex items-center gap-1 text-sm text-white/80">
                      <Calendar className="w-4 h-4" />
                      {new Date(post.publishedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Title block — only render when there's no hero image, so we
                don't double up the title in two places. */}
            {!post.heroImageUrl && (
              <header className="mb-8">
                <h1 className="text-4xl sm:text-5xl font-bold text-text leading-tight mb-4">
                  {post.title}
                </h1>
                {post.publishedAt && (
                  <div className="flex items-center gap-1 text-sm text-text-secondary">
                    <Calendar className="w-4 h-4" />
                    {new Date(post.publishedAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                )}
              </header>
            )}

            {/* Excerpt — sits above the body, below the hero/title. Sets
                the reader's expectation for what they're about to dive
                into. */}
            <p className="text-lg text-text-secondary mb-10">{post.excerpt}</p>

            <div
              className="prose prose-base max-w-none prose-headings:font-bold prose-headings:text-text prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2 prose-p:text-text prose-p:my-3 prose-a:text-primary hover:prose-a:underline prose-strong:font-bold prose-strong:text-text prose-img:rounded-xl prose-blockquote:border-l-4 prose-blockquote:border-l-primary prose-blockquote:text-text-secondary prose-blockquote:pl-4 prose-blockquote:my-4 prose-ul:my-3 prose-ol:my-3 prose-li:my-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* YouTube embed — sits between the body and the gallery if
                present. */}
            {post.youtubeVideoId && (
              <div className="mt-12">
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

            {/* Trip photo gallery — click any thumbnail to enlarge. */}
            {outingPhotosArray.length > 0 && (
              <section className="mt-12 pt-8 border-t border-slate-200">
                <h2 className="text-2xl font-bold text-text mb-6">Trip Photos</h2>
                <OutingPhotoGallery photos={outingPhotosArray} title={post.title} />
              </section>
            )}
          </div>
        </div>

        {/* Byline — same shape as /life (clickable author card, or non-link
            card when the post has no author relation). */}
        <OutingByline
          author={
            post.author
              ? {
                  slug: post.author.slug,
                  displayName: post.author.displayName,
                  title: post.author.title,
                  companyName: post.author.companyName,
                  photoUrl: post.author.photoUrl,
                }
              : null
          }
        />
      </article>
    </>
  )
}
