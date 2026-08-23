import Link from 'next/link'
import { ChevronLeft, Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/JsonLd'
import { BestOfNomineeCard } from '@/components/best-of/BestOfNomineeCard'
import { VoteButton } from '@/components/best-of/VoteButton'
import { VotersFeed } from '@/components/best-of/VotersFeed'

interface Props {
  params: Promise<{ category: string }>
}

async function getCategory(slug: string) {
  return prisma.bestOfCategory.findUnique({
    where: { slug, published: true },
    include: {
      nominees: {
        orderBy: [{ winner: 'desc' }, { displayOrder: 'asc' }],
        include: {
          business: {
            select: {
              id: true, name: true, slug: true, tagline: true, description: true,
              address: true, city: true, state: true, zip: true,
              logo: true, coverImage: true, photos: true,
              tier: true, status: true, hasCoupon: true,
              isBestOfWinner: true, isExpertPartner: true, foundingPartnerSince: true,
              website: true, phone: true, email: true,
              googleRating: true, googleReviewCount: true,
              seHablaEspanol: true, chamberMember: true, hispanicChamberMember: true,
              category: { select: { name: true, slug: true } },
              reviews: { select: { rating: true } },
              _count: { select: { reviews: true } },
            },
          },
        },
      },
      subCategories: {
        where: { published: true },
        orderBy: { name: 'asc' },
        include: {
          nominees: {
            orderBy: [{ winner: 'desc' }, { displayOrder: 'asc' }],
            include: {
              business: {
                select: {
                  id: true, name: true, slug: true, tagline: true, description: true,
                  address: true, city: true, state: true, zip: true,
                  logo: true, coverImage: true, photos: true,
                  tier: true, status: true, hasCoupon: true,
                  isBestOfWinner: true, isExpertPartner: true, foundingPartnerSince: true,
                  website: true, phone: true, email: true,
                  googleRating: true, googleReviewCount: true,
                  seHablaEspanol: true, chamberMember: true, hispanicChamberMember: true,
                  category: { select: { name: true, slug: true } },
                  reviews: { select: { rating: true } },
                  _count: { select: { reviews: true } },
                },
              },
            },
          },
          _count: { select: { nominees: true } },
        },
      },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params
  const cat = await getCategory(slug)
  if (!cat) return { title: 'Not Found' }
  const pageUrl = `https://www.moval.living/best-of/${slug}`
  const description = cat.description || `Our editor's pick for ${cat.name} in Moreno Valley.`
  return {
    title: cat.name,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'website',
      url: pageUrl,
      title: cat.name,
      description,
      images: [{ url: `https://www.moval.living/og/${slug}.png`, width: 1200, height: 630, alt: cat.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: cat.name,
      description,
      images: [`https://www.moval.living/og/${slug}.png`],
    },
  }
}

function buildBestOfCategorySchema(cat: Awaited<ReturnType<typeof getCategory>>) {
  if (!cat) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cat.name,
    description: cat.description || `Our editor's pick for ${cat.name} in Moreno Valley.`,
    url: `https://www.moval.living/best-of/${cat.slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'MoVal Living',
      url: 'https://www.moval.living',
    },
  }
}

function buildNomineesItemList(cat: Awaited<ReturnType<typeof getCategory>>) {
  if (!cat || cat.nominees.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${cat.name} — moval.living Best Of`,
    numberOfItems: cat.nominees.length,
    itemListElement: cat.nominees.map((nominee, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: nominee.business.name,
      url: `https://www.moval.living/business/${nominee.business.slug}`,
    })),
  }
}

export default async function BestOfCategoryPage({ params }: Props) {
  const { category: slug } = await params
  const cat = await getCategory(slug)
  if (!cat) return null

  const nominees = cat.nominees
  const emoji = cat.icon ? getCategoryEmoji(cat.icon) : '⭐'
  const categorySchema = buildBestOfCategorySchema(cat)
  const itemListSchema = buildNomineesItemList(cat)

  const session = await auth()
  const voterId = session?.user?.id ?? null
  const allNomineeIds = nominees.map((n) => n.id)
  const allSubNomineeIds = cat.subCategories.flatMap(sub => sub.nominees.map(n => n.id))
  const everyNomineeId = [...allNomineeIds, ...allSubNomineeIds]

  const [userVotes, votesByNominee, recentVotersRaw] = await Promise.all([
    voterId && everyNomineeId.length > 0
      ? prisma.bestOfVote.findMany({
          where: { voterId, nomineeId: { in: everyNomineeId } },
          select: { id: true, nomineeId: true },
        })
      : Promise.resolve([]),
    everyNomineeId.length > 0
      ? prisma.bestOfVote.groupBy({
          by: ['nomineeId'],
          where: { nomineeId: { in: everyNomineeId } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    everyNomineeId.length > 0
      ? prisma.bestOfVote.findMany({
          where: { nomineeId: { in: everyNomineeId } },
          orderBy: [{ nomineeId: 'asc' }, { createdAt: 'desc' }],
          take: everyNomineeId.length * 12,
          select: {
            nomineeId: true,
            voterNameSnapshot: true,
            voterImageSnapshot: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ])

  const userVoteByNominee = new Map(userVotes.map((v) => [v.nomineeId, v.id]))
  const totalVotesByNominee = new Map(votesByNominee.map((v) => [v.nomineeId, v._count._all]))
  const recentVotersByNominee = new Map<string, { name: string; image: string | null; votedAt: string }[]>()
  for (const v of recentVotersRaw) {
    const list = recentVotersByNominee.get(v.nomineeId) ?? []
    if (list.length >= 12) continue
    list.push({
      name: v.voterNameSnapshot,
      image: v.voterImageSnapshot,
      votedAt: v.createdAt.toISOString(),
    })
    recentVotersByNominee.set(v.nomineeId, list)
  }

  const signedIn = Boolean(session?.user?.id)

  return (
    <>
      {categorySchema && <JsonLd schema={categorySchema} />}
      {itemListSchema && <JsonLd schema={itemListSchema} />}
      <div className="bg-slate-50 min-h-screen">
        {/* Back nav */}
        <div className="bg-white border-b border-slate-100">
          <div className="container-max py-4">
            <Link href="/best-of" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors">
              <ChevronLeft className="w-4 h-4" /> All Best Of Categories
            </Link>
          </div>
        </div>

        {/* Category header */}
        <div className="bg-gradient-to-br from-primary to-secondary">
          <div className="container-max py-12 md:py-16">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{emoji}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Best Of Moreno Valley
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{cat.name}</h1>
            <AnswerCapsule cat={cat} nominees={nominees} />
            {cat.description && (
              <p className="text-white/80 text-base md:text-lg max-w-2xl mt-4">{cat.description}</p>
            )}
          </div>
        </div>

        <div className="container-max py-10 md:py-14">
          {cat.subCategories.length > 0 ? (
            <div className="space-y-16">
              {cat.subCategories.map(sub => (
                <SubCategorySection
                  key={sub.id}
                  sub={sub}
                  categorySlug={slug}
                  signedIn={signedIn}
                  userVoteByNominee={userVoteByNominee}
                  totalVotesByNominee={totalVotesByNominee}
                  recentVotersByNominee={recentVotersByNominee}
                />
              ))}
            </div>
          ) : nominees.length === 0 ? (
            <EmptyState emoji={emoji} />
          ) : (
            <NomineeList
              nominees={nominees}
              categorySlug={slug}
              signedIn={signedIn}
              userVoteByNominee={userVoteByNominee}
              totalVotesByNominee={totalVotesByNominee}
              recentVotersByNominee={recentVotersByNominee}
            />
          )}
        </div>

        {/* Bottom CTA */}
        <section className="bg-white border-t border-slate-100">
          <div className="container-max py-12">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-2xl font-bold text-text mb-3">Think someone else belongs here?</h2>
              <p className="text-text-secondary mb-6">
                Nominations are open year-round. If your favorite MoVal business isn&apos;t listed, tell us about it.
              </p>
              <Link
                href="/submit/best-of"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nominate a business
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

function AnswerCapsule({ cat, nominees }: { cat: Awaited<ReturnType<typeof getCategory>>; nominees: Nominee[] }) {
  if (!cat) return null

  if (cat.subCategories.length > 0) {
    const subWinners = cat.subCategories
      .map(sub => {
        const w = sub.nominees.find(n => n.winner) ?? sub.nominees[0]
        return w ? { sub: sub.name, name: w.business.name } : null
      })
      .filter((x): x is { sub: string; name: string } => x !== null)
      .slice(0, 4)
    if (subWinners.length > 0) {
      const category = cat.name.replace(/^best\s+/i, '').toLowerCase()
      const list = subWinners.map(sw => `${sw.name} (${sw.sub})`).join(', ').replace(/, ([^,]*)$/, ', and $1')
      return (
        <p className="text-white text-lg max-w-3xl leading-relaxed">
          The best {category} in Moreno Valley span multiple sub-categories — current community picks: {list}.
        </p>
      )
    }
  }

  if (nominees.length > 0) {
    const winner = nominees.find(n => n.winner)
    const runnersUp = nominees.filter(n => n.winner).length === 1
      ? nominees.filter(n => !n.winner)
      : nominees.slice(1)
    const winnerName = winner?.business.name ?? nominees[0]?.business.name
    const category = cat.name.replace(/^best\s+/i, '').toLowerCase()
    let sentence: string
    if (winner) {
      sentence = `🏆 ${winnerName} is the community pick for the best ${category} in Moreno Valley`
    } else {
      sentence = `${winnerName} is our editors' top pick for the best ${category} in Moreno Valley`
    }
    if (runnersUp.length === 1) sentence += `, with ${runnersUp[0].business.name} also nominated.`
    else if (runnersUp.length >= 2) {
      const names = runnersUp.slice(0, 2).map(n => n.business.name)
      sentence += `, with ${names.join(' and ')} and other local nominees also in the running.`
    } else sentence += '.'
    sentence += ` Picked from ${nominees.length} community nomination${nominees.length === 1 ? '' : 's'} and reviewed by our editors.`
    return <p className="text-white text-lg max-w-3xl leading-relaxed">{sentence}</p>
  }

  return <p className="text-white text-lg max-w-3xl leading-relaxed">The best {cat.name.toLowerCase()} in Moreno Valley — our editors are reviewing community nominations now.</p>
}

function EmptyState({ emoji }: { emoji: string }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
      <p className="text-5xl mb-4">{emoji}</p>
      <h2 className="text-xl font-bold text-text mb-2">Coming Soon</h2>
      <p className="text-text-secondary">Our editors are working on this pick. Check back soon!</p>
    </div>
  )
}

function NomineeList({
  nominees,
  categorySlug,
  signedIn,
  userVoteByNominee,
  totalVotesByNominee,
  recentVotersByNominee,
}: {
  nominees: Nominee[]
  categorySlug: string
  signedIn: boolean
  userVoteByNominee: Map<string, string>
  totalVotesByNominee: Map<string, number>
  recentVotersByNominee: Map<string, { name: string; image: string | null; votedAt: string }[]>
}) {
  const winner = nominees.find(n => n.winner)
  const winners = nominees.filter(n => n.winner)
  const nonWinners = nominees.filter(n => !n.winner)

  return (
    <div className="space-y-12">
      {winner && winners.length === 1 && (
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-2xl">🏆</span>
            <h2 className="text-2xl font-bold text-text">Winner</h2>
          </div>
          <div className="max-w-3xl mx-auto">
            <CardWithVote
              nominee={winner}
              variant="winner"
              rank={1}
              categorySlug={categorySlug}
              signedIn={signedIn}
              userVoteByNominee={userVoteByNominee}
              totalVotesByNominee={totalVotesByNominee}
              recentVotersByNominee={recentVotersByNominee}
            />
          </div>
        </section>
      )}

      {winners.length > 1 && (
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-2xl">🏆</span>
            <h2 className="text-2xl font-bold text-text">Winners</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {winners.map((nominee, idx) => (
              <CardWithVote
                key={nominee.id}
                nominee={nominee}
                variant="winner"
                rank={idx + 1}
                categorySlug={categorySlug}
                signedIn={signedIn}
                userVoteByNominee={userVoteByNominee}
                totalVotesByNominee={totalVotesByNominee}
                recentVotersByNominee={recentVotersByNominee}
              />
            ))}
          </div>
        </section>
      )}

      {nonWinners.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-2xl">⭐</span>
            <h2 className="text-2xl font-bold text-text">Nominees</h2>
            <span className="text-sm text-text-secondary ml-2">{nonWinners.length} business{nonWinners.length === 1 ? '' : 'es'} in the running</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nonWinners.map((nominee, idx) => (
              <CardWithVote
                key={nominee.id}
                nominee={nominee}
                variant="nominee"
                rank={idx + 1}
                categorySlug={categorySlug}
                signedIn={signedIn}
                userVoteByNominee={userVoteByNominee}
                totalVotesByNominee={totalVotesByNominee}
                recentVotersByNominee={recentVotersByNominee}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SubCategorySection({
  sub,
  categorySlug,
  signedIn,
  userVoteByNominee,
  totalVotesByNominee,
  recentVotersByNominee,
}: {
  sub: SubCategoryRow
  categorySlug: string
  signedIn: boolean
  userVoteByNominee: Map<string, string>
  totalVotesByNominee: Map<string, number>
  recentVotersByNominee: Map<string, { name: string; image: string | null; votedAt: string }[]>
}) {
  const winner = sub.nominees.find(n => n.winner)
  const winners = sub.nominees.filter(n => n.winner)
  const nonWinners = sub.nominees.filter(n => !n.winner)
  const emoji = sub.icon ? getCategoryEmoji(sub.icon) : '🏆'

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{emoji}</span>
        <h2 className="text-xl sm:text-2xl font-bold text-text">{sub.name}</h2>
        {sub._count.nominees > 0 && (
          <span className="text-xs bg-slate-100 text-text-secondary px-2 py-0.5 rounded-full">
            {sub._count.nominees} {sub._count.nominees === 1 ? 'nominee' : 'nominees'}
          </span>
        )}
      </div>

      {sub.nominees.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center text-text-secondary">
          No nominees yet. <Link href="/submit/best-of" className="text-primary hover:underline">Be the first to nominate one</Link>.
        </div>
      ) : (
        <div className="space-y-10">
          {winner && winners.length === 1 && (
            <div className="max-w-3xl">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-3">Winner</h3>
              <CardWithVote
                nominee={winner}
                variant="winner"
                rank={1}
                categorySlug={categorySlug}
                signedIn={signedIn}
                userVoteByNominee={userVoteByNominee}
                totalVotesByNominee={totalVotesByNominee}
                recentVotersByNominee={recentVotersByNominee}
              />
            </div>
          )}

          {winners.length > 1 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-3">Winners</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                {winners.map((nominee, idx) => (
                  <CardWithVote
                    key={nominee.id}
                    nominee={nominee}
                    variant="winner"
                    rank={idx + 1}
                    categorySlug={categorySlug}
                    signedIn={signedIn}
                    userVoteByNominee={userVoteByNominee}
                    totalVotesByNominee={totalVotesByNominee}
                    recentVotersByNominee={recentVotersByNominee}
                  />
                ))}
              </div>
            </div>
          )}

          {nonWinners.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary mb-3">Nominees</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nonWinners.map((nominee, idx) => (
                  <CardWithVote
                    key={nominee.id}
                    nominee={nominee}
                    variant="nominee"
                    rank={idx + 1}
                    categorySlug={categorySlug}
                    signedIn={signedIn}
                    userVoteByNominee={userVoteByNominee}
                    totalVotesByNominee={totalVotesByNominee}
                    recentVotersByNominee={recentVotersByNominee}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function CardWithVote({
  nominee,
  variant,
  rank,
  categorySlug,
  signedIn,
  userVoteByNominee,
  totalVotesByNominee,
  recentVotersByNominee,
}: {
  nominee: Nominee
  variant: 'winner' | 'nominee'
  rank: number
  categorySlug: string
  signedIn: boolean
  userVoteByNominee: Map<string, string>
  totalVotesByNominee: Map<string, number>
  recentVotersByNominee: Map<string, { name: string; image: string | null; votedAt: string }[]>
}) {
  const totalVotes = totalVotesByNominee.get(nominee.id) ?? 0
  const recentVoters = recentVotersByNominee.get(nominee.id) ?? []

  return (
    <div>
      <BestOfNomineeCard
        business={nominee.business}
        variant={variant}
        rank={rank}
        notes={nominee.notes}
      />
      <div className="mt-3 px-1">
        <VoteButton
          nomineeId={nominee.id}
          nomineeName={nominee.business.name}
          categorySlug={categorySlug}
          initialVoted={userVoteByNominee.has(nominee.id)}
          initialVoteId={userVoteByNominee.get(nominee.id)}
          signedIn={signedIn}
          variant={variant === 'nominee' ? 'small' : 'default'}
        />
        <VotersFeed voters={recentVoters} total={totalVotes} displayed={recentVoters.length} />
      </div>
    </div>
  )
}

type Nominee = {
  id: string
  categoryId: string
  businessId: string
  winner: boolean
  notes: string | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
  business: {
    id: string
    slug: string
    name: string
    tagline: string | null
    description: string
    address: string
    city: string
    state: string
    zip: string
    logo: string | null
    coverImage: string | null
    photos: string[]
    tier: string
    status: string
    hasCoupon: boolean
    isBestOfWinner: boolean
    isExpertPartner: boolean
    foundingPartnerSince: string | Date | null
    website: string | null
    phone: string | null
    email: string | null
    googleRating: number | null
    googleReviewCount: number | null
    seHablaEspanol: boolean
    chamberMember: boolean
    hispanicChamberMember: boolean
    category: { name: string; slug: string }
    reviews: Array<{ rating: number }>
    _count: { reviews: number }
  }
}

type SubCategoryRow = {
  id: string
  slug: string
  name: string
  icon: string | null
  nominees: Nominee[]
  _count: { nominees: number }
}

function getCategoryEmoji(icon: string): string {
  const map: Record<string, string> = {
    Taco: '🌮', Coffee: '☕', Beef: '🍔', Pizza: '🍕',
    Sunrise: '🌅', Flame: '🔥', ShoppingBag: '🛍️', Heart: '💑',
    Trophy: '🏆', UtensilsCrossed: '🍽️', Wrench: '🔧', Scissors: '✂️',
    Droplets: '💧', Trees: '🌳', Building: '🏢', PawPrint: '🐾',
    Activity: '🏃', Home: '🏠', Car: '🚗', Briefcase: '💼',
  }
  return map[icon] ?? '⭐'
}
