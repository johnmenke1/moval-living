// Smoke test against the actual schema code in the project
import { guestPostCreateSchema } from '../src/lib/guest-content.ts'

// What the panel sends for a Life post with no Spotify, no images, no metadata
const lifePayload = {
  postType: 'LIFE',
  slug: 'diagnostic-life-post',
  title: 'Diagnostic Test',
  excerpt: 'Test excerpt',
  body: 'Test body',
  heroImageUrl: null,
  scheduledFor: null,
  metaTitle: null,
  metaDescription: null,
  spotifyTrack1: null,
  spotifyTrack2: null,
}

const r1 = guestPostCreateSchema.safeParse(lifePayload)
console.log('Life post (no authorId):', r1.success ? '✓' : '✗')
if (!r1.success) console.log(JSON.stringify(r1.error.issues, null, 2))

// What if user fills Spotify tracks?
const lifeWithSpotify = {
  ...lifePayload,
  spotifyTrack1: '4PTG3Z6ehGkBFwjybzWkR8',
  spotifyTrack2: '7qiZfU4dY1lWllzX7mPBI3',
}
const r2 = guestPostCreateSchema.safeParse(lifeWithSpotify)
console.log('Life post (with Spotify):', r2.success ? '✓' : '✗')
if (!r2.success) console.log(JSON.stringify(r2.error.issues, null, 2))

// Guest post with author and FAQ
const guestPayload = {
  postType: 'GUEST',
  slug: 'diagnostic-guest-post',
  title: 'Test',
  excerpt: 'Test',
  body: 'Test',
  authorId: 'test-author-id',
  faqItems: [{ question: 'Q?', answer: 'A.' }],
}
const r3 = guestPostCreateSchema.safeParse(guestPayload)
console.log('Guest post:', r3.success ? '✓' : '✗')
if (!r3.success) console.log(JSON.stringify(r3.error.issues, null, 2))