import { getPrisma } from '../src/lib/prisma.ts';
import { put } from '@vercel/blob';

const FAL_MODEL = 'fal-ai/recraft/v3/text-to-image';
const FAL_BASE = 'https://queue.fal.run';

function buildPrompt(sub: { title: string; venueName: string | null; sourcePostCaption: string | null }): string {
  const venue = sub.venueName || 'a community space';
  const cityMatch = venue.match(/,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*CA/i);
  const city = cityMatch ? cityMatch[1] : 'Southern California';
  const cleanVenue = venue.replace(/^\d+[^,]*,/, '').trim() || 'a community space';
  return [
    `Editorial photograph of an outdoor community gathering.`,
    `Setting: ${cleanVenue}, ${city}.`,
    `Photographic style, magazine quality, golden hour natural lighting.`,
    `Real people, candid moment, atmospheric scene, journalistic photograph.`,
    `No text of any kind visible in the image.`,
    `Pure unedited photograph with no overlay or graphics.`,
  ].join(' ');
}

function buildNegativePrompt(): string {
  return [
    'text, words, letters, typography, signage, alphabetic characters',
    'event title banners, magazine headers, newspaper mastheads',
    'watermark logos, sponsor badges, corner logos, branded overlays',
    'street signs, storefront signs, building signs with words, banners with words',
    'banners, posters with words, captions, titles, subtitles',
    't-shirts with text, hats with text, umbrellas with words',
    'gibberish writing, fake letters, blurry text, unreadable text',
    'event poster style, flyer, advertisement layout, sponsored content look',
  ].join(', ');
}

async function generateImage(prompt: string, apiKey: string): Promise<string> {
  const submitRes = await fetch(`${FAL_BASE}/${FAL_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_16_9',
      num_images: 1,
      negative_prompt: buildNegativePrompt(),
    }),
  });
  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw new Error(`fal submit failed: ${submitRes.status} ${body.slice(0, 200)}`);
  }
  const { status_url, response_url } = await submitRes.json();

  let attempts = 0;
  let lastStatus: string | null = null;
  while (attempts < 90) {
    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
    const pollRes = await fetch(status_url, { headers: { Authorization: `Key ${apiKey}` } });
    if (!pollRes.ok) continue;
    const pollText = await pollRes.text();
    if (!pollText) continue;
    let poll: any;
    try { poll = JSON.parse(pollText); } catch { continue; }
    lastStatus = poll.status;
    if (poll.status === 'COMPLETED') break;
    if (poll.status === 'FAILED') throw new Error(`fal failed: ${JSON.stringify(poll)}`);
  }
  if (lastStatus !== 'COMPLETED') throw new Error(`fal poll timed out (last status: ${lastStatus})`);

  const resultRes = await fetch(response_url, { headers: { Authorization: `Key ${apiKey}` } });
  if (!resultRes.ok) throw new Error(`fal result fetch failed: ${resultRes.status}`);
  const result = await resultRes.json();
  const out = result?.images?.[0]?.url ?? result?.image?.url ?? null;
  if (!out) throw new Error(`fal returned no image: ${JSON.stringify(result).slice(0, 300)}`);
  return out;
}

async function uploadToBlob(imageUrl: string, slug: string, blobToken: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`image fetch failed: ${imgRes.status}`);
  const contentType = imgRes.headers.get('content-type') ?? 'image/png';
  const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const blobPath = `events/${slug}/hero-${Date.now()}.${ext}`;
  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType,
    token: blobToken,
    addRandomSuffix: false,
  });
  return blob.url;
}

async function processOne(slug: string): Promise<void> {
  const prisma = getPrisma();
  const sub = await prisma.submission.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, venueName: true, sourcePostCaption: true },
  });
  if (!sub) {
    console.error(`Submission not found: ${slug}`);
    return;
  }

  console.log(`\n=== ${sub.slug} | ${sub.title} ===`);
  console.log(`venue: ${sub.venueName}`);
  console.log(`prompt: ${buildPrompt(sub)}`);
  console.log(`negative: ${buildNegativePrompt()}`);

  const falKey = process.env.FAL_KEY;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!falKey) { console.error('FAL_KEY not set'); return; }
  if (!blobToken) { console.error('BLOB_READ_WRITE_TOKEN not set'); return; }

  try {
    const prompt = buildPrompt(sub);
    const falImageUrl = await generateImage(prompt, falKey);
    console.log(`fal returned: ${falImageUrl}`);
    const blobUrl = await uploadToBlob(falImageUrl, sub.slug, blobToken);
    console.log(`uploaded to blob: ${blobUrl}`);
    await prisma.submission.update({
      where: { id: sub.id },
      data: { thumbnailUrl: blobUrl, sourceCapturedAt: new Date() },
    });
    console.log(`✓ wrote thumbnailUrl to Submission ${sub.slug}`);
  } catch (e) {
    console.error(`✗ failed for ${sub.slug}:`, e instanceof Error ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  for (const slug of process.argv.slice(2)) {
    await processOne(slug);
  }
}

main();
