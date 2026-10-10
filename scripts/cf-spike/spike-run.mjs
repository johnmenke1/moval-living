import EmbeddedPostgres from 'embedded-postgres'
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spike-pg-'))
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'test', password: 'test', port: 54330, persistent: false })
await pg.initialise(); await pg.start(); await pg.createDatabase('spike')
const ddl = execSync('npx drizzle-kit export --sql --config drizzle.config.ts', { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgres://u:u@localhost:1/u' } }).split('\n').filter(l => !l.startsWith('◇')).join('\n')
const c = pg.getPgClient('spike'); await c.connect(); await c.query(ddl)
await c.end()
execSync('npx tsx scripts/cf-spike/spike-seed.ts', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: 'postgres://test:test@127.0.0.1:54330/spike' } })


const url = 'postgres://test:test@127.0.0.1:54330/spike'
fs.writeFileSync('.dev.vars', `DATABASE_URL=${url}\nAUTH_SECRET=spikesecretspikesecretspikesecret12\nAUTH_URL=http://localhost:4173\nAUTH_TRUST_HOST=true\nNEXTAUTH_URL=http://localhost:4173\n`)
const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], { env: { ...process.env, DATABASE_URL: url }, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d)
await new Promise(r => setTimeout(r, 12000))
const get = async (p, opts) => { try { const r = await fetch('http://127.0.0.1:4173' + p, { redirect: 'manual', ...opts }); const t = await r.text(); return `${p} -> ${r.status} len=${t.length} ${t.includes('Acme Diner') ? '[has Acme]' : ''} ${r.status>=500? t.slice(0,300).replace(/\s+/g,' '):''}` } catch (e) { return `${p} -> ERR ${e.message}` } }
for (const p of ['/', '/business/acme', '/category/food', '/api/categories', '/api/businesses/acme/reviews', '/api/auth/session', '/api/auth/csrf', '/login', '/events', '/best-of', '/sitemap.xml', '/search?q=acme', '/deals', '/dashboard']) console.log(await get(p))

{
  const base='http://127.0.0.1:4173'
  const r1=await fetch(base+'/api/auth/csrf'); const {csrfToken}=await r1.json()
  const ck=r1.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')
  const r2=await fetch(base+'/api/auth/callback/credentials',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded',cookie:ck},body:new URLSearchParams({csrfToken,email:'test@example.com',password:'Password123!',json:'true'})})
  const ck2=[ck,...r2.headers.getSetCookie().map(c=>c.split(';')[0])].join('; ')
  console.log('LOGIN', r2.status, r2.headers.get('location'), r2.headers.getSetCookie().map(c=>c.split('=')[0]))
  const s2=await (await fetch(base+'/api/auth/session',{headers:{cookie:ck2}})).text()
  console.log('SESSION', s2.slice(0,200))
  const d=await fetch(base+'/dashboard',{redirect:'manual',headers:{cookie:ck2}})
  console.log('DASHBOARD', d.status, d.headers.get('location'))
}
console.log('---- server log tail\n' + log.slice(-2500))
srv.kill('SIGKILL'); await pg.stop(); fs.rmSync(dir, { recursive: true, force: true })
process.exit(0)
