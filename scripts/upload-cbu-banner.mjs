/**
 * upload-cbu-banner.mjs
 *
 * One-shot: read the CBU hero banner from local disk and upload it
 * to Vercel Blob. Prints the resulting Blob URL.
 *
 * Run: node scripts/upload-cbu-banner.mjs <local-path-to-image>
 * (BLOB_READ_WRITE_TOKEN must be in env)
 */

import { put } from '@vercel/blob'
import fs from 'node:fs'

const path = process.argv[2]
if (!path) {
  console.error('usage: node scripts/upload-cbu-banner.mjs <path-to-image>')
  process.exit(1)
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN required')
  process.exit(1)
}

const buffer = fs.readFileSync(path)
const ext = path.split('.').pop() || 'png'
const blobPath = `events/cbu/cbu-sports-banner-${Date.now()}.${ext}`
const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp'
const blob = await put(blobPath, buffer, { access: 'public', contentType })
console.log(blob.url)
