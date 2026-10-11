import EmbeddedPostgres from 'embedded-postgres'
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-pg-'))
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'test', password: 'test', port: 54330, persistent: false })
await pg.initialise(); await pg.start(); await pg.createDatabase('spike')
const ddl = execSync('npx drizzle-kit export --sql --config drizzle.config.ts', { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgres://u:u@localhost:1/u' } }).split('\n').filter(l => !l.startsWith('◇')).join('\n')
const c = pg.getPgClient('spike'); await c.connect(); await c.query(ddl)
const svg = (a, b, t) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><text x="400" y="270" font-size="60" text-anchor="middle" fill="white" font-family="sans-serif">${t}</text></svg>`)
const homes = [
  ['The Garcia Graveyard', 'Rise and shine', 'Spookiest', 'Near Elm St', 33.9441, -117.2312, 42, '#3b1566', '#ff7a1a'],
  ['Pumpkin Palace', 'Fun for the whole family', 'Best Kid-Friendly', '2210 Sunnymead Blvd', 33.9258, -117.2105, 31, '#0b3d2e', '#ff9a4a'],
  ['Skeleton Crew Cul-de-sac', 'Twenty-two skeletons', 'Most Creative', 'Near Heacock St', 33.9601, -117.2449, 17, '#222', '#8b3dff'],
]
let n = 0
for (const [name, tag, cat, label, lat, lng, votes, a, b] of homes) {
  const id = 'e' + (++n)
  await c.query(`insert into "HalloweenEntry"(id,"displayName",tagline,description,category,"contactName","contactEmail","streetAddress","addressKey",latitude,longitude,"publicLatitude","publicLongitude","locationLabel","photoUrls",status,"updatedAt") values ($1,$2,$3,$4,$5,'x','x@x.co','1 st',$1,$6,$7,$6,$7,$8,$9,'APPROVED',now())`, [id, name, tag, 'Forty skeletons, a fog machine that never quits, and a candy-grabbing hand. Best viewed after dark - come on by!', cat, lat, lng, label, [svg(a, b, name)]])
  for (let i = 0; i < votes; i++) await c.query(`insert into "HalloweenVote"(id,"entryId","ipHash","deviceId") values ($1,$2,$3,$3)`, [`v${n}_${i}`, id, `h${n}_${i}`])
}
await c.end()
fs.writeFileSync('.dev.vars', `DATABASE_URL=postgres://test:test@127.0.0.1:54330/spike\nAUTH_SECRET=spikesecretspikesecretspikesecret12\nAUTH_URL=http://localhost:4173\nAUTH_TRUST_HOST=true\nR2_PUBLIC_URL=https://media.example.test\n`)
const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], { stdio: 'ignore' })
await new Promise(r => setTimeout(r, 12000))
const out = process.env.SHOTS_DIR
const base = 'http://127.0.0.1:4173'
for (const [name, p] of [['home', '/halloween'], ['enter', '/halloween/enter']]) {
  let html = await (await fetch(base + p)).text()
  const links = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(m => m[0])
  let css = ''
  for (const l of links) {
    const href = l.match(/href="([^"]+)"/)[1]
    let t = await (await fetch(new URL(href, base))).text()
    const urls = [...new Set([...t.matchAll(/url\(([^)]+)\)/g)].map(m => m[1].replace(/["']/g, '')))]
    for (const u of urls) {
      if (u.startsWith('data:')) continue
      try { const r = await fetch(new URL(u, new URL(href, base))); const buf = Buffer.from(await r.arrayBuffer()); t = t.split(u).join(`data:${r.headers.get('content-type') || 'font/woff2'};base64,${buf.toString('base64')}`) } catch {}
    }
    css += t + '\n'
    html = html.replace(l, '')
  }
  // inline url() fonts referenced from inline <style> blocks (next/font)
  for (const m of [...html.matchAll(/url\((\/_next\/[^)]+)\)/g)]) {
    try { const r = await fetch(base + m[1]); const buf = Buffer.from(await r.arrayBuffer()); html = html.split(m[1]).join(`data:font/woff2;base64,${buf.toString('base64')}`) } catch {}
  }
  html = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]+rel="preload"[^>]*>/g, '').replace('</head>', `<style>${css}</style></head>`)
  fs.writeFileSync(`${out}/${name}.html`, html)
}
srv.kill('SIGKILL'); await pg.stop(); fs.rmSync(dir, { recursive: true, force: true }); process.exit(0)
