'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, MessageSquare, Trophy, Inbox, Users, FileText, Activity, Shield, Calendar, Layers } from 'lucide-react'
import BusinessesModeration from '@/components/admin/BusinessesModeration'
import SocialPostsModeration from '@/components/admin/SocialPostsModeration'
import BestOfAdmin from '@/components/admin/BestOfAdmin'
import BestOfNominationsPanel from '@/components/admin/BestOfNominationsPanel'
import GuestAuthorsPanel from '@/components/admin/GuestAuthorsPanel'
import GuestPostsPanel from '@/components/admin/GuestPostsPanel'
import EventSubmissionsPanel from '@/components/admin/EventSubmissionsPanel'
import EventsAdminPanel from '@/components/admin/EventsAdminPanel'
import DiagnosticsPanel from '@/components/admin/DiagnosticsPanel'
import AuditsPanel from '@/components/admin/AuditsPanel'
import { clsx } from 'clsx'

// "Live Events" tab was removed 2026-08-16: the curation workflow lives
// inside the "Events" (submissions) tab. After approving, the submission
// stays in the APPROVED bucket of the same list and you can edit the
// resulting event from there. Two tabs for two states was redundant.

interface AdminTabsProps {
  businesses: any[]
  posts: any[]
  bestOfCategories: any[]
  bestOfNominations: any[]
  bestOfNominationCategories: any[]
  guestAuthors: any[]
  guestPosts: any[]
  approvedBusinesses: any[]
  eventSubmissions: any[]
  eventsForDuplicate: any[]
  events: any[]
  archivedEvents: any[]
}

type TabKey = 'businesses' | 'social' | 'events' | 'events-admin' | 'bestof' | 'bestofnominations' | 'guestauthors' | 'guestposts' | 'audits' | 'diagnostics'

const TABS: { key: TabKey; label: string; icon: typeof Building2; count?: (p: AdminTabsProps) => number }[] = [
  { key: 'businesses', label: 'Businesses', icon: Building2,
    count: (p) => p.businesses.filter((b: any) => b.status === 'PENDING').length },
  { key: 'social', label: 'Social Posts', icon: MessageSquare,
    count: (p) => p.posts.filter((x: any) => x.status === 'PENDING').length },
  { key: 'events', label: 'Event Submissions', icon: Calendar,
    count: (p) => p.eventSubmissions.filter((x: any) => x.status === 'PENDING').length },
  { key: 'events-admin', label: 'Live Events', icon: Layers,
    count: (p) => p.events.length },
  { key: 'bestof', label: 'Best Of', icon: Trophy,
    count: (p) => p.bestOfCategories.length },
  { key: 'bestofnominations', label: 'Nominations', icon: Inbox,
    count: (p) => p.bestOfNominations.filter((n: any) => n.status === 'PENDING').length },
  { key: 'guestauthors', label: 'Guest Authors', icon: Users,
    count: (p) => p.guestAuthors.filter((a: any) => a.isActive).length },
  { key: 'guestposts', label: 'Posts', icon: FileText,
    count: (p) => p.guestPosts.filter((x: any) => x.status === 'draft').length },
  { key: 'audits', label: 'Audits', icon: Shield },
  { key: 'diagnostics', label: 'Diagnostics', icon: Activity },
]

export default function AdminTabs({ businesses, posts, bestOfCategories, bestOfNominations, bestOfNominationCategories, guestAuthors, guestPosts, approvedBusinesses, eventSubmissions, eventsForDuplicate, events, archivedEvents }: AdminTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams?.get('tab') as TabKey | null
  const [active, setActive] = useState<TabKey>(
    tabFromUrl && TABS.some((t) => t.key === tabFromUrl) ? tabFromUrl : 'businesses'
  )

  const handleTabChange = (key: TabKey) => {
    setActive(key)
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('tab', key)
    router.replace(`/dashboard?${params.toString()}`, { scroll: false })
  }

  const props = { businesses, posts, bestOfCategories, bestOfNominations, bestOfNominationCategories, guestAuthors, guestPosts, approvedBusinesses, eventSubmissions, eventsForDuplicate, events, archivedEvents }

  return (
    <div>
      {/* Tab nav */}
      <div className="border-b border-slate-200 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max" role="tablist">
          {TABS.map(({ key, label, icon: Icon, count }) => {
            const n = count?.(props) ?? 0
            const isActive = active === key
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(key)}
                className={clsx(
                  'inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text hover:border-slate-300'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                {n > 0 && (
                  <span
                    className={clsx(
                      'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold',
                      isActive ? 'bg-primary text-white' : 'bg-slate-200 text-text-secondary'
                    )}
                  >
                    {n}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active panel */}
      <div role="tabpanel">
        {active === 'businesses' && <BusinessesModeration initialBusinesses={businesses} />}
        {active === 'social' && <SocialPostsModeration initialPosts={posts} />}
        {active === 'bestof' && <BestOfAdmin initialCategories={bestOfCategories} />}
        {active === 'bestofnominations' && (
          <BestOfNominationsPanel
            initialNominations={bestOfNominations}
            initialCategories={bestOfNominationCategories}
          />
        )}
        {active === 'guestauthors' && <GuestAuthorsPanel initialAuthors={guestAuthors} approvedBusinesses={approvedBusinesses} />}
        {active === 'guestposts' && <GuestPostsPanel initialPosts={guestPosts} authors={guestAuthors.map((a: any) => ({ id: a.id, displayName: a.displayName, slug: a.slug }))} />}
        {active === 'events' && <EventSubmissionsPanel initialSubmissions={eventSubmissions} existingEvents={eventsForDuplicate} />}
        {active === 'events-admin' && <EventsAdminPanel events={events} archivedEvents={archivedEvents} />}
        {active === 'audits' && <AuditsPanel />}
        {active === 'diagnostics' && <DiagnosticsPanel />}
      </div>
    </div>
  )
}
