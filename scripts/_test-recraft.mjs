const FAL_KEY = 'cd68b96e-2138-4c6a-bf0f-e70c4ec6747c:7bf3092430557e8b889a40d4748feac4'
const FAL_BASE = 'https://queue.fal.run'

// Test recraft with negative_prompt = "text, words, letters, signage"
const submitRes = await fetch(`${FAL_BASE}/fal-ai/recraft/v3/text-to-image`, {
  method: 'POST',
  headers: {
    Authorization: `Key ${FAL_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'Outdoor community event scene at a historic stone castle at dusk with string lights, crowd of people, vendor tents. Photographic style, magazine quality.',
    image_size: 'landscape_16_9',
    num_images: 1,
    negative_prompt: 'text, words, letters, typography, signage, posters, banners, captions, watermarks, signs with writing, t-shirts with text, logos with words',
  }),
})
console.log('Submit:', submitRes.status)
const { status_url, response_url, request_id } = await submitRes.json()
console.log('request_id:', request_id)

// Poll
let attempts = 0
let last = null
while (attempts < 60) {
  await new Promise((r) => setTimeout(r, 1000))
  attempts++
  const r = await fetch(status_url, { headers: { Authorization: `Key ${FAL_KEY}` } })
  const t = await r.text()
  if (!t) continue
  try {
    const p = JSON.parse(t)
    last = p.status
    if (p.status === 'COMPLETED') break
    if (p.status === 'FAILED') { console.log('FAILED:', p); process.exit(1) }
  } catch {}
}

const resultRes = await fetch(response_url, { headers: { Authorization: `Key ${FAL_KEY}` } })
const result = await resultRes.json()
console.log('Image URL:', result.images?.[0]?.url?.slice(0, 100))
console.log('Dimensions:', result.images?.[0]?.width, 'x', result.images?.[0]?.height)
