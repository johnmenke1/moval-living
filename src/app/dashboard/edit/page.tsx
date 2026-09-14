import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import EditBusinessClient from '@/components/business/EditBusinessClient'
import { DealsManager } from '@/components/business/DealsManager'

// /dashboard/edit renders two different surfaces depending on the
// caller:
//   - Owner editing their own business → EditBusinessClient (legacy
//     "Edit Listing" form, single-coupon editor included).
//   - Admin editing any business (via ?id=...) → tabbed view with
//     "Details" (same EditBusinessClient) and "Deals" (the shared
//     <DealsManager>). The Deals tab is what Johnny approved for the
//     "admin adds deals on behalf of a business" workflow on 2026-09-14.
// Owners have a separate /dashboard/deals page for a fuller deal UX
// (link lives on /dashboard home).

export default async function EditBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; tab?: string }>
}) {
  const session = await auth()
  const { id, tab } = await searchParams

  if (!session?.user?.id) {
    redirect('/login')
  }

  const isAdmin = session.user.role === 'ADMIN'

  // Admin can pass ?id= to edit any business
  if (isAdmin && id) {
    const business = await prisma.business.findUnique({
      where: { id },
      include: {
        category: true,
        deals: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        },
      },
    })
    if (!business) redirect('/dashboard')

    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })

    // Default to Details tab; tab=deals switches to the DealsManager.
    const activeTab: 'details' | 'deals' = tab === 'deals' ? 'deals' : 'details'

    return (
      <div className="bg-slate-50 min-h-screen">
        {/* Admin tab strip — keeps the Details form and the Deals
            panel in the same URL so deep-linking works. href-based
            navigation so the tab survives a hard refresh and the
            browser back button. */}
        <div className="bg-white border-b border-slate-100">
          <div className="container-max py-6">
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary mb-3 transition-colors">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-text mb-1">
              Editing <span className="text-primary">{business.name}</span>
            </h1>
            <p className="text-text-secondary text-sm mb-4">
              Admin path — changes apply immediately. Use the tabs below to switch between business details and deals.
            </p>
            <div className="flex items-center gap-1 border-b border-slate-100 -mb-px">
              <AdminTabLink href={`/dashboard/edit?id=${business.id}`} label="Details" active={activeTab === 'details'} />
              <AdminTabLink href={`/dashboard/edit?id=${business.id}&tab=deals`} label={`Deals${business.deals.length ? ` (${business.deals.length})` : ''}`} active={activeTab === 'deals'} />
            </div>
          </div>
        </div>

        <div className="container-max py-8">
          <div className="max-w-3xl mx-auto">
            {activeTab === 'details' ? (
              (() => {
                // Admin ?id= path — map the first active Deal row to the
                // legacy `coupon` shape that EditBusinessClient's existing
                // form fields bind to. Mirrors the owner-path mapping
                // further down in this file.
                const firstDeal = business.deals[0]
                const couponShape = firstDeal
                  ? {
                      headline: firstDeal.headline,
                      description: firstDeal.description ?? '',
                      code: firstDeal.code,
                      expiresAt: firstDeal.expiresAt ? firstDeal.expiresAt.toISOString().slice(0, 10) : null,
                      imageUrl: firstDeal.imageUrl,
                    }
                  : null
                return (
                  <EditBusinessClient
                    business={{
                      ...business,
                      hours: (business.hours as Record<string, { open: string; close: string; closed: boolean }>) || null,
                      hasCoupon: !!firstDeal,
                      coupon: couponShape,
                      _firstDealId: firstDeal?.id ?? null,
                    } as never}
                    categories={categories as never}
                    isAdmin
                  />
                )
              })()
            ) : (
              <DealsManager
                businessId={business.id}
                businessName={business.name}
                deals={business.deals.map(d => ({
                  ...d,
                  startsAt: d.startsAt ? d.startsAt.toISOString() : null,
                  expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
                  createdAt: d.createdAt.toISOString(),
                  updatedAt: d.updatedAt.toISOString(),
                }))}
                contextLabel={`You are editing deals on behalf of ${business.name}. Changes apply immediately and become visible on the public /deals page when isActive is true.`}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Owner editing their own business (legacy single-tab path). We pull
  // the first/only active deal so the inline deal-editor block in
  // EditBusinessClient can pre-populate from the new Deal model instead
  // of the (now-dropped) Business.coupon Json blob. Deeper deal
  // management lives at /dashboard/deals for owners who want to manage
  // more than one offer.
  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    include: {
      business: {
        include: {
          deals: {
            where: { isActive: true },
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
            take: 1,
          },
        },
      },
    },
  })

  if (!owner?.business) {
    redirect('/dashboard')
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  })

  // Map the first deal (if any) to the legacy `coupon` shape so the
  // EditBusinessClient prop type stays stable for this commit. The next
  // refactor can move EditBusinessClient to a typed `deal` prop.
  const firstDeal = owner.business.deals[0]
  const couponShape = firstDeal
    ? {
        headline: firstDeal.headline,
        description: firstDeal.description ?? '',
        code: firstDeal.code,
        expiresAt: firstDeal.expiresAt ? firstDeal.expiresAt.toISOString().slice(0, 10) : null,
        imageUrl: firstDeal.imageUrl,
      }
    : null

  return (
    <EditBusinessClient
      business={{
        ...owner.business,
        hours: (owner.business.hours as Record<string, { open: string; close: string; closed: boolean }>) || null,
        hasCoupon: !!firstDeal,
        coupon: couponShape,
        // Carry the Deal id so submit can PATCH instead of POST when
        // updating an existing offer.
        _firstDealId: firstDeal?.id ?? null,
      } as never}
      categories={categories as never}
    />
  )
}

function AdminTabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'px-4 py-2.5 text-sm font-semibold text-primary border-b-2 border-primary -mb-px transition-colors'
          : 'px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-primary border-b-2 border-transparent -mb-px transition-colors'
      }
    >
      {label}
    </Link>
  )
}
