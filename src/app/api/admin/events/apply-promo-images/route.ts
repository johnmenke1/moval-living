/**
 * POST /api/admin/events/apply-promo-images
 *
 * Internal endpoint: replaces Recraft-generated hero images with the actual
 * Ticketmaster promo image for each event. For Live Nation-venue shows (Fox
 * Riverside, RMA), Ticketmaster exposes high-quality promo images in their
 * JSON-LD structured data — way better than AI-generated scenes because
 * they're the official show artwork.
 *
 * The Recraft images all looked the same (generic outdoor amphitheater scenes)
 * because we used the same venue name for every show. Promo images give each
 * event its actual identity.
 *
 * Body:
 *   { eventIds?: string[] }   // limit to specific event IDs (Ticketmaster IDs);
 *                              // if omitted, processes all Fox+RMA pending submissions
 *   OR
 *   { all: true }             // same as omitting eventIds
 *
 * Response:
 *   { updated: number, results: [{ slug, eventId, status, thumbnailUrl? }] }
 *
 * Auth: admin OR CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

const schema = z.object({
  eventIds: z.array(z.string()).optional(),
  all: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  // Two auth paths
  const cronSecret = process.env.CRON_SECRET
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  const isCron = cronSecret && bearer === cronSecret
  if (!isCron) {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: unknown = {}
  try { body = await req.json() } catch {}
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  // Find target Events — Fox + RMA with Ticketmaster source URLs
  const events = await prisma.event.findMany({
    where: {
      venueTag: { in: ['FOX_RIVERSIDE', 'RIVERSIDE_MUNICIPAL_AUDITORIUM'] },
      sourceUrl: { contains: 'ticketmaster.com' },
    },
    select: { id: true, slug: true, sourceUrl: true, originatingSubmissionId: true },
  })

  // Build eventId map + filter
  const targets = events
    .map(e => {
      const m = e.sourceUrl.match(/event\/([A-Z0-9]+)/)
      return m ? { ...e, eventId: m[1] } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const filtered = parsed.data.eventIds?.length
    ? targets.filter(t => parsed.data.eventIds!.includes(t.eventId))
    : targets

  const results: Array<{ slug: string; eventId: string; status: 'success' | 'error' | 'no-promo'; thumbnailUrl?: string; error?: string }> = []

  for (const t of filtered) {
    // Look up the promo URL from the JSON-LD data we collected
    // We embed the lookup table here since we don't have a persistent store
    const promoUrl = PROMO_MAP[t.eventId]
    if (!promoUrl) {
      results.push({ slug: t.slug, eventId: t.eventId, status: 'no-promo' })
      continue
    }

    try {
      // Download promo from Ticketmaster
      const imgRes = await fetch(promoUrl, {
        headers: { 'User-Agent': 'moval.living/0.1 (curated-events@example.com)' },
      })
      if (!imgRes.ok) throw new Error(`download failed: ${imgRes.status}`)
      const buffer = Buffer.from(await imgRes.arrayBuffer())
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
      const ext = contentType.includes('png') ? 'png' : 'jpg'
      const blobPath = `events/${t.slug}/promo-${Date.now()}.${ext}`

      // Upload to Vercel Blob
      const blob = await put(blobPath, buffer, { access: 'public', contentType })

      // Update event hero
      await prisma.event.update({
        where: { id: t.id },
        data: { heroImageUrl: blob.url },
      })

      // Also update originating Submission's thumbnail if it exists,
      // so future re-ingests / regenerates keep the right image.
      if (t.originatingSubmissionId) {
        await prisma.submission.update({
          where: { id: t.originatingSubmissionId },
          data: { thumbnailUrl: blob.url },
        })
      }

      results.push({ slug: t.slug, eventId: t.eventId, status: 'success', thumbnailUrl: blob.url })
    } catch (err) {
      results.push({
        slug: t.slug,
        eventId: t.eventId,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    updated: results.filter(r => r.status === 'success').length,
    results,
  })
}

// Embed the event-id → promo-url map. Built from JSON-LD scraped from
// foxriverside.com/shows + riversiderma.com/shows on 2026-08-15.
// In a future iteration, this should be a DB table populated by a weekly
// scrape job — for now, inline is fine since it changes slowly.
const PROMO_MAP: Record<string, string> = {
  // Fox Riverside Performing Arts Center
  "0B006496A9214AA1": "https://s1.ticketm.net/dam/a/7f2/2bc93316-e0d1-436d-a386-b3898092f7f2_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064E79D59266B": "https://s1.ticketm.net/dam/a/999/404b403e-566c-4158-8ef6-d1d0a53c0999_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064D2B49C38E2": "https://s1.ticketm.net/dam/e/7b6/6cd3ead4-b960-40b1-8f3c-ebd3143917b6_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006497A54A568C": "https://s1.ticketm.net/dam/c/fbc/b293c0ad-c904-4215-bc59-8d7f2414dfbc_106141_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00648D94232877": "https://s1.ticketm.net/dam/e/8ac/458cbf80-985a-47a5-8660-06e04be7f8ac_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00648992F32EDC": "https://s1.ticketm.net/dam/c/f50/96fa13be-e395-429b-8558-a51bb9054f50_105951_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006446A22239F5": "https://s1.ticketm.net/dam/a/4a2/f044bd80-ab67-4319-ad3a-3a94631394a2_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064E7CE3B41E0": "https://s1.ticketm.net/dam/a/f60/761f97bd-3c39-4555-923a-64c39cde4f60_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064C1A7D3589F": "https://s1.ticketm.net/dam/e/6f7/aa84311a-f741-4036-a7be-455d4d0e96f7_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006462BE3F4393": "https://s1.ticketm.net/dam/a/4d4/d963b745-c842-4a74-8678-58e1508774d4_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006462BE434396": "https://s1.ticketm.net/dam/a/4d4/d963b745-c842-4a74-8678-58e1508774d4_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006490BAF045EF": "https://s1.ticketm.net/dam/a/815/82c8ae95-7c71-4813-8888-a4a6ba86c815_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006483F19A8811": "https://s1.ticketm.net/dam/a/096/1deb5fde-0f44-4ece-a818-1c145758c096_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064ACA44F3BC9": "https://s1.ticketm.net/dam/a/f8d/a2759b35-f441-4493-9453-468b2f700f8d_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064D6A6882CE4": "https://s1.ticketm.net/dam/a/0db/facb3ce6-790b-4e96-8417-48f844fa70db_1670131_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00642CA3662405": "https://s1.ticketm.net/dam/e/7e0/22b40d8d-c4d6-4c6c-9820-486aa7fba7e0_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006464D49E50AF": "https://s1.ticketm.net/dam/c/07d/fda8c807-42eb-4b81-9f16-f3a8367e107d_106371_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00649DCFCA7E7A": "https://s1.ticketm.net/dam/a/8cc/668571b4-9ae7-45a5-9867-947994e128cc_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064C8A1D92FAA": "https://s1.ticketm.net/dam/a/879/eb0656ac-c826-4a4a-944e-7ba18cf9f879_816351_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00643DA52843B3": "https://s1.ticketm.net/dam/a/b20/6af3f817-14e2-4579-a5b5-712c8cffdb20_1790271_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006505A83B3DB7": "https://s1.ticketm.net/dam/e/dc7/0f8f86a0-d163-4089-8095-276637b86dc7_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006452C3F17087": "https://s1.ticketm.net/dam/a/afb/c865f8e3-1785-4e98-9401-eaba7613fafb_726571_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064D6AD7630D9": "https://s1.ticketm.net/dam/a/db1/d418ed09-1fbb-4bde-ab98-a1cace426db1_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064A6CA4573D6": "https://s1.ticketm.net/dam/a/b82/fb28d804-c5e8-4d8e-91cd-815b52e7db82_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00649BD7467012": "https://s1.ticketm.net/dam/a/fd6/a4a8431d-f2a0-4756-8ff7-adbeee16bfd6_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064EE98DA3701": "https://s1.ticketm.net/dam/a/8c5/a810da7d-83a4-4c27-a9a5-961de88948c5_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006472ADCE47D5": "https://s1.ticketm.net/dam/a/e1b/f47c7258-5b27-4fd1-a278-399d5a711e1b_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00649DDD378523": "https://s1.ticketm.net/dam/a/216/4080c07a-cd76-4f5f-8726-54a3fcc86216_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064F4C60A3867": "https://s1.ticketm.net/dam/e/c44/47afbf06-d945-46f6-85ae-a453baea5c44_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064F4C60F386B": "https://s1.ticketm.net/dam/e/eef/1cab3880-1ae5-4848-b7c2-d8abba0d8eef_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064EE9D383A86": "https://s1.ticketm.net/dam/a/442/30c353ea-61e3-496e-9f2a-f812f4e40442_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006509FB5484F0": "https://s1.ticketm.net/dam/a/cf1/4410d085-bc26-4ffd-9d33-a443aa15ecf1_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  // Riverside Municipal Auditorium
  "0B0064E69A7B2373": "https://s1.ticketm.net/dam/e/cd6/ff612223-95e9-4203-aaa5-b3f8d5814cd6_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064AC9F51366B": "https://s1.ticketm.net/dam/a/051/58f8541d-70ed-408d-bb05-abd7b252d051_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064DBD8AF4AB5": "https://s1.ticketm.net/dam/a/c20/0b1c8b5b-be17-41cf-8d4c-7ba639e29c20_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006488B2E0448C": "https://s1.ticketm.net/dam/a/8a7/e4fb6cf8-d140-4f13-af91-36ef0ee478a7_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064DB8B741DF9": "https://s1.ticketm.net/dam/a/d3c/a20a910a-b0d7-4706-b01d-49c874660d3c_1633531_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064CFA15828E0": "https://s1.ticketm.net/dam/c/fbc/b293c0ad-c904-4215-bc59-8d7f2414dfbc_106141_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064CF9BF826F8": "https://s1.ticketm.net/dam/e/850/faf4787c-d3da-4a78-9f09-c1fa97f69850_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00649C0C59931E": "https://s1.ticketm.net/dam/a/c2b/f24d8c3b-1623-4bd0-b748-1515da144c2b_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064F8C3154837": "https://s1.ticketm.net/dam/a/d99/7d0d36d0-4cf5-4649-b647-d0e85bd55d99_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00650ACA4F7FC7": "https://s1.ticketm.net/dam/a/937/06f3770b-0b33-435a-b067-55f5ff989937_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00649DC8D27A5E": "https://s1.ticketm.net/dam/a/b4f/ac0372f1-c214-46ca-8880-694266792b4f_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064AFAE015548": "https://s1.ticketm.net/dam/a/ed9/e37ec7e8-090d-41c8-afa1-9d691a917ed9_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064D1AAF435F7": "https://s1.ticketm.net/dam/a/524/d8d9916c-a288-46ef-9a8f-9594adb6d524_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064EEA1C13E4F": "https://s1.ticketm.net/dam/a/6a2/4888f9e6-832c-40ec-a01b-218780dfc6a2_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064B4AF6D5853": "https://s1.ticketm.net/dam/a/6d4/27216fa5-518a-4f8b-97ea-8262386626d4_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006464D3B35053": "https://s1.ticketm.net/dam/a/469/f6db8121-664a-4972-9853-b1eb4d318469_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B00648ABC775890": "https://s1.ticketm.net/dam/a/0ad/2715f828-d867-417d-a621-9226eeed80ad_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064BCB60362CE": "https://s1.ticketm.net/dam/a/7b7/dea1fbc1-8dc4-43b9-80fd-80b0f7d857b7_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006486B0733BAB": "https://s1.ticketm.net/dam/a/5d2/98da185a-7dcb-4b43-bef0-844ed85165d2_1174191_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064AFB7055A9B": "https://s1.ticketm.net/dam/a/3b5/08cefbd6-5bc5-4252-bd8b-f3e0e8ba33b5_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006489AE9A43EF": "https://s1.ticketm.net/dam/a/29a/a51c94b9-3106-4de8-aa1e-4ed23839e29a_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006496B46954E6": "https://s1.ticketm.net/dam/e/8b7/561518a4-ad85-47d6-aa51-dfe8616db8b7_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064B2CC5761FF": "https://s1.ticketm.net/dam/a/927/c53f67c9-a283-4982-800e-78bf078e7927_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064FF92AE338C": "https://s1.ticketm.net/dam/a/a33/aaeb3973-7e8e-49ae-985e-fc8549dbda33_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064ED924C28A8": "https://s1.ticketm.net/dam/a/70b/dcda4fe8-2449-483c-93a1-03877718a70b_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064FDB43D44F5": "https://s1.ticketm.net/dam/e/bd1/8a5632d8-7a0e-4d90-bb45-9634a6a66bd1_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064A7F55DAB0E": "https://s1.ticketm.net/dam/a/5e7/226e1492-f104-4407-97d0-6d6a21af15e7_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064C7C7465EEF": "https://s1.ticketm.net/dam/a/b0f/179e3fee-6a4e-4a3c-8017-de6ba086eb0f_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064C3961244C2": "https://s1.ticketm.net/dam/a/762/707b5aed-2537-4fc0-9f79-57789bbcd762_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064ED9CD5308C": "https://s1.ticketm.net/dam/a/60f/7dca79da-4a1a-4849-9603-26e6f5bc160f_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064F7AB4A4137": "https://s1.ticketm.net/dam/a/2c2/94d29ae7-d310-42b0-bf7e-ed6a433032c2_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064C89382284D": "https://s1.ticketm.net/dam/a/08b/9a17598b-5f9e-4668-915a-2689c5e5308b_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B006505C4C95285": "https://s1.ticketm.net/dam/a/235/0263fa23-a1b5-45bf-987a-70770815b235_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064E7972023AE": "https://s1.ticketm.net/dam/a/551/375a5480-571a-4831-807b-eb5fc7b5d551_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064F4A69427EA": "https://s1.ticketm.net/dam/a/893/372a5db9-3060-4f2a-ab27-3f9a66da9893_TABLET_LANDSCAPE_LARGE_16_9.jpg",
  "0B0064E8C12B4DA1": "https://s1.ticketm.net/dam/a/09c/9e9ac8fc-aac7-4d17-b9cc-d145a903c09c_TABLET_LANDSCAPE_LARGE_16_9.jpg",
}
