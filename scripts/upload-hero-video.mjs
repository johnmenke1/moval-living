/**
 * upload-hero-video.mjs
 *
 * One-shot: upload the homepage hero video + poster JPG to Vercel Blob.
 * Run: node scripts/upload-hero-video.mjs
 * (BLOB_READ_WRITE_TOKEN must be in env)
 *
 * The encoded artifacts live in
 *   ~/.hermes/profiles/emma/cache/videos/encoded/
 * (hero-video.webm, hero-video.mp4, hero-video-poster.jpg)
 * and were produced by ffmpeg from the source drone aerial — see
 * the home hero video feature commit for the exact ffmpeg flags.
 *
 * Outputs the three public Blob URLs to stdout, one per line:
 *   <webm-url>
 *   <mp4-url>
 *   <poster-url>
 *
 * The poster URL gets pinned in HomePageClient.tsx as the static LCP
 * image (so visitors on slow connections never see an empty hero).
 * The video URLs go in the <video> element's <source> children.
 */

import { put } from '@vercel/blob'
import fs from 'node:fs'

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN required (set in env before running).')
  process.exit(1)
}

// Allow override of source paths via argv; otherwise use canonical
// Hermes cache paths. Lets you re-run the script after editing the
// encoder without touching this file.
const SRC_DIR = process.argv[2] ?? 'C:/Users/john/AppData/Local/hermes/profiles/emma/cache/videos/encoded'

const ARTIFACTS = [
  { file: 'hero-video.webm', blobPath: 'home/hero-video.webm', contentType: 'video/webm' },
  { file: 'hero-video.mp4',  blobPath: 'home/hero-video.mp4',  contentType: 'video/mp4' },
  { file: 'hero-video-poster.jpg', blobPath: 'home/hero-video-poster.jpg', contentType: 'image/jpeg' },
]

const urls = []
for (const a of ARTIFACTS) {
  const localPath = `${SRC_DIR}/${a.file}`
  if (!fs.existsSync(localPath)) {
    console.error(`Missing local artifact: ${localPath}`)
    process.exit(1)
  }
  const buf = fs.readFileSync(localPath)
  // addRandomSuffix=false → same filename on overwrite (predictable URLs
  // that match what we hard-code in the React component after this runs).
  const blob = await put(a.blobPath, buf, {
    access: 'public',
    contentType: a.contentType,
    addRandomSuffix: false,
  })
  const sizeKB = (buf.length / 1024).toFixed(0)
  console.error(`✓ ${a.file} (${sizeKB} KB) → ${blob.url}`)
  urls.push(blob.url)
}

// Plain stdout — easy to capture into an `urls.txt` or shell var.
console.log(urls.join('\n'))
