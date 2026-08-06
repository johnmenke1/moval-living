import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink, ArrowLeft, Building2 } from 'lucide-react'
import {
  LinkedinIcon,
  TwitterIcon,
  FacebookIcon,
  InstagramIcon,
} from '@/components/social/SocialIcons'
import { prisma } from '@/lib/prisma'
import { JsonLd } from '@/components/seo/JsonLd'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

async function getAuthor(slug: string) {
  const author = await prisma.guestAuthor.findUnique({
    where: { slug },
    include: {
      posts: {
        where: { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          heroImageUrl: true,
          publishedAt: true,
        },
      },
    },
  })
  if (!author || !author.isActive) return null
  return author
}

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params
  const author = await getAuthor(slug)
  if (!author) return { title: 'Not found' }

  const title = author.displayName
  const description = author.bio.slice(0, 160)
  const url = `https://www.moval.living/authors/${author.slug}`

  return {
    title,
    description,
    openGraph: {
      type: 'profile',
      url,
      title,
      description,
      images: author.photoUrl ? [author.photoUrl] : undefined,
      firstName: author.displayName.split(' ')[0],
      lastName: author.displayName.split(' ').slice(1).join(' ') || undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: author.photoUrl ? [author.photoUrl] : undefined,
    },
    alternates: { canonical: url },
  }
}

export default async function AuthorPage({ params }: Ctx) {
  const { slug } = await params
  const author = await getAuthor(slug)
  if (!author) notFound()

  const url = `https://www.moval.living/authors/${author.slug}`

  // Person schema. This is the *hub* — Google's authority signal for the
  // byline pattern. The same shape appears on each post page so all the
  // post articles triangulate back to this canonical Person record.
  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.displayName,
    url,
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

  const links = [
    { url: author.linkedinUrl, Icon: LinkedinIcon, label: 'LinkedIn' },
    { url: author.twitterUrl, Icon: TwitterIcon, label: 'Twitter / X' },
    { url: author.facebookUrl, Icon: FacebookIcon, label: 'Facebook' },
    { url: author.instagramUrl, Icon: InstagramIcon, label: 'Instagram' },
    { url: author.personalSiteUrl, Icon: ExternalLink, label: 'Personal site' },
    { url: author.companyUrl, Icon: Building2, label: author.companyName || 'Company' },
  ].filter((l): l is { url: string; Icon: typeof LinkedinIcon; label: string } => Boolean(l.url))

  return (
    <>
      <JsonLd schema={personSchema} />

      <div className="bg-background min-h-screen">
        <div className="container-max pt-8">
          <Link
            href="/insights"
            className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            All Insights
          </Link>
        </div>

        <div className="container-max py-12">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <header className="flex flex-col sm:flex-row gap-6 items-start mb-10">
              <div className="w-32 h-32 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                {author.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={author.photoUrl}
                    alt={author.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl font-bold">
                    {author.displayName
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-bold text-text mb-2">
                  {author.displayName}
                </h1>
                {author.title && (
                  <div className="text-lg text-text-secondary mb-1">{author.title}</div>
                )}
                {author.companyName && (
                  <div className="text-base text-text-secondary inline-flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {author.companyUrl ? (
                      <a
                        href={author.companyUrl}
                        rel="sponsored noopener"
                        target="_blank"
                        className="hover:text-primary"
                      >
                        {author.companyName}
                      </a>
                    ) : (
                      <span>{author.companyName}</span>
                    )}
                  </div>
                )}

                {/* Social links */}
                {links.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {links.map(({ url: linkUrl, Icon, label }) => (
                      <a
                        key={label}
                        href={linkUrl}
                        rel="sponsored noopener"
                        target="_blank"
                        title={label}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 text-text-secondary hover:text-primary hover:border-primary transition-colors"
                      >
                        <Icon className="w-4 h-4" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </header>

            {/* Bio */}
            <div className="bg-white border border-slate-100 rounded-xl p-6 mb-10">
              <p className="text-text leading-relaxed whitespace-pre-line">
                {author.bio}
              </p>
            </div>

            {/* Posts */}
            <section>
              <h2 className="text-2xl font-bold text-text mb-4">
                Posts by {author.displayName.split(' ')[0]}
                <span className="text-text-secondary font-normal text-base ml-2">
                  ({author.posts.length})
                </span>
              </h2>
              {author.posts.length === 0 ? (
                <p className="text-text-secondary">No posts yet.</p>
              ) : (
                <div className="space-y-4">
                  {author.posts.map((post) => (
                    <article
                      key={post.id}
                      className="bg-white border border-slate-100 rounded-xl p-5 hover:border-primary transition-colors"
                    >
                      <h3 className="text-lg font-bold text-text mb-2">
                        <Link
                          href={`/insights/${post.slug}`}
                          className="hover:text-primary"
                        >
                          {post.title}
                        </Link>
                      </h3>
                      <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                        {post.excerpt}
                      </p>
                      {post.publishedAt && (
                        <div className="text-xs text-text-secondary">
                          {new Date(post.publishedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  )
}