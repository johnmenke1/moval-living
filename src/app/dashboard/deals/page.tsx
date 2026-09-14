import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { DealsManager } from '@/components/business/DealsManager'
import Link from 'next/link'
import { ChevronLeft, Tag } from 'lucide-react'

// Owner-facing deals manager. Loaded at /dashboard/deals. Loads the
// logged-in owner's business + all of its deals (active and inactive)
// and hands them to the shared <DealsManager> client component.
//
// Same layout shape as /dashboard/edit so users feel oriented.

export default async function OwnerDealsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  // Admins get pointed at the per-business edit page (which now has a
  // Deals tab) — they don't need this owner-facing shortcut. Non-admins
  // are always owners of at most one business.
  if (session.user.role === 'ADMIN') {
    redirect('/dashboard')
  }

  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          deals: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
          },
        },
      },
    },
  })

  if (!owner?.business) {
    redirect('/dashboard')
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-8">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary mb-3 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Tag className="w-5 h-5 text-accent" />
            </div>
            <h1 className="text-3xl font-bold text-text">Deals</h1>
          </div>
          <p className="text-text-secondary">
            Promotions for <strong>{owner.business.name}</strong>. Each deal appears as its own card on the public <code className="text-xs bg-slate-100 px-1 rounded">/deals</code> page.
          </p>
        </div>
      </div>

      <div className="container-max py-8">
        <div className="max-w-3xl mx-auto">
          <DealsManager
            businessId={owner.business.id}
            businessName={owner.business.name}
            deals={owner.business.deals.map(d => ({
              ...d,
              // Serialize Date → ISO so the client component receives a
              // consistent shape. toISOString() never fails for valid
              // Date instances; null/undefined pass through unchanged.
              startsAt: d.startsAt ? d.startsAt.toISOString() : null,
              expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
              createdAt: d.createdAt.toISOString(),
              updatedAt: d.updatedAt.toISOString(),
            }))}
          />
        </div>
      </div>
    </div>
  )
}
