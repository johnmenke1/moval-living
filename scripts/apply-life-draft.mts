// Apply the contents of `content/life/<slug>.md` to the matching LIFE
// draft in the database. Idempotent: re-running just overwrites the body
// with the file's contents.
//
// Usage:
//   npx tsx scripts/apply-life-draft.mts <slug>
//
// The slug must match an existing GuestPost row with postType='LIFE'.
// (Find slugs via the dashboard, or `SELECT slug FROM "GuestPost"
// WHERE "postType" = 'LIFE' ORDER BY "createdAt" DESC;`)
//
// Example:
//   npx tsx scripts/apply-life-draft.mts where-to-eat-in-moreno-valley-local-guide
//   npx tsx scripts/apply-life-draft.mts a-veterans-guide-to-moreno-valley
import { config } from 'dotenv'
config()
config({ path: '.env.local', override: true })
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

async function main() {
  const slug = process.argv[2]
  if (!slug) {
    console.error('Usage: npx tsx scripts/apply-life-draft.mts <slug>')
    process.exit(1)
  }
  const filePath = resolve(`content/life/${slug}.md`)

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    console.error(`Available .md files in content/life:`)
    try {
      const { readdirSync } = await import('node:fs')
      for (const f of readdirSync('content/life')) {
        if (f.endsWith('.md')) console.error(`  ${f}`)
      }
    } catch {}
    process.exit(1)
  }

  const newBody = readFileSync(filePath, 'utf8')
  const { prisma } = await import('../src/lib/prisma')

  const existing = await prisma.guestPost.findUnique({
    where: { slug },
    select: { id: true, postType: true, title: true, status: true, updatedAt: true },
  })
  if (!existing) {
    console.error(`No GuestPost row with slug "${slug}". Create it via the dashboard first.`)
    process.exit(1)
  }
  if (existing.postType !== 'LIFE') {
    console.error(`Post "${slug}" is postType="${existing.postType}", not LIFE. Refusing to overwrite.`)
    process.exit(1)
  }

  const updated = await prisma.guestPost.update({
    where: { slug },
    data: { body: newBody },
    select: {
      id: true, slug: true, title: true, status: true,
      metaTitle: true, metaDescription: true, updatedAt: true,
    },
  })

  console.log('=== Updated ===')
  console.log(JSON.stringify(updated, null, 2))
  console.log('Body length:', newBody.length, 'chars')
  console.log('Source file:', filePath)
  await prisma.$disconnect()
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })