// End-to-end smoke test for the Halloween contest against embedded Postgres + the built Worker.
// Prereq: `vite build` done, and HALLOWEEN dates in src/lib/halloween.ts opened wide for the run.
import EmbeddedPostgres from 'embedded-postgres'
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-pg-'))
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'test', password: 'test', port: 54330, persistent: false })
await pg.initialise(); await pg.start(); await pg.createDatabase('spike')
const ddl = execSync('npx drizzle-kit export --sql --config drizzle.config.ts', { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'postgres://u:u@localhost:1/u' } }).split('\n').filter(l => !l.startsWith('◇')).join('\n')
const c = pg.getPgClient('spike'); await c.connect(); await c.query(ddl); await c.end()
execSync('npx tsx scripts/cloudflare/smoke/spike-seed.ts', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: 'postgres://test:test@127.0.0.1:54330/spike' } })

const url = 'postgres://test:test@127.0.0.1:54330/spike'
fs.writeFileSync('.dev.vars', `DATABASE_URL=${url}\nAUTH_SECRET=spikesecretspikesecretspikesecret12\nAUTH_URL=http://localhost:4173\nAUTH_TRUST_HOST=true\nNEXTAUTH_URL=http://localhost:4173\nR2_PUBLIC_URL=https://media.example.test\n`)
const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--host', '127.0.0.1'], { env: { ...process.env, DATABASE_URL: url }, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d)
await new Promise(r => setTimeout(r, 12000))

const base = 'http://127.0.0.1:4173'
let fails = 0
const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`) }
const j = async (p, opts = {}) => { const r = await fetch(base + p, { redirect: 'manual', ...opts }); const t = await r.text(); let d; try { d = JSON.parse(t) } catch {} return { r, t, d } }

// pages
for (const p of ['/halloween', '/halloween/enter']) { const { r, t } = await j(p); check(`GET ${p}`, r.status === 200 && /Haunted|haunted/.test(t), `-> ${r.status}`) }
check('admin page redirects when logged out', (await j('/dashboard/halloween')).r.status >= 300)
check('admin API 401 when logged out', (await j('/api/admin/halloween/entries')).r.status === 401)

// submit
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const submit = async (over = {}, files = 1) => {
  const fd = new FormData()
  const f = { displayName: 'The Garcia Graveyard', tagline: 'Rise and shine', description: 'Forty skeletons and a fog machine that never quits.', category: 'Spookiest', contactName: 'Ana Garcia', contactEmail: 'ana@example.com', contactPhone: '9515550100', streetAddress: '1234 Elm St', zip: '92553', showExactAddress: 'false', turnstileToken: '', ...over }
  for (const [k, v] of Object.entries(f)) fd.append(k, v)
  for (let i = 0; i < files; i++) fd.append('photos', new Blob([png], { type: 'image/png' }), `p${i}.png`)
  return j('/api/halloween/entries', { method: 'POST', body: fd, headers: { 'cf-connecting-ip': '198.51.100.7' } })
}
const s1 = await submit(); check('submit entry', s1.r.status === 200 && s1.d?.ok, `-> ${s1.r.status} ${s1.t.slice(0, 120)}`)
const id = s1.d?.id
// Anonymous submission (no name/email) - should succeed and persist nulls.
const anon = await submit({ streetAddress: '8 Phantom Way', contactName: '', contactEmail: '', contactPhone: '' });
check('anonymous submit accepted', anon.r.status === 200 && anon.d?.ok, `-> ${anon.r.status} ${anon.t.slice(0, 120)}`)
const anonId = anon.d?.id
check('duplicate address rejected', (await submit()).r.status === 409)
check('no photo now allowed (address-only submissions accepted)', (await submit({ streetAddress: '9 Other St' }, 0)).r.status === 200)
check('rules-not-accepted (legacy field) is now ignored by server', (await submit({ streetAddress: '10 Other St', agreeRules: 'false' })).r.status === 200)
// Address-only submission (no photo, no display name, no description, no contact) still succeeds.
const minimal = await submit({ streetAddress: '12 Minimal St', displayName: '', description: '', contactName: '', contactEmail: '', contactPhone: '' }, 0)
check('address-only submission accepted (no photo, no name, no description)', minimal.r.status === 200 && minimal.d?.ok, `-> ${minimal.r.status} ${minimal.t.slice(0, 120)}`)
const minimalId = minimal.d?.id
const hp = await submit({ streetAddress: '11 Bot St', website: 'spam.example' }); check('honeypot silently ok but not stored', hp.r.status === 200 && !hp.d?.id)

// pending entries are invisible
let list = await j('/api/halloween/entries')
check('pending not public', list.d?.entries?.length === 0)

// admin login
const r1 = await fetch(base + '/api/auth/csrf'); const { csrfToken } = await r1.json()
const ck = r1.headers.getSetCookie().map(x => x.split(';')[0]).join('; ')
const r2 = await fetch(base + '/api/auth/callback/credentials', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: ck }, body: new URLSearchParams({ csrfToken, email: 'test@example.com', password: 'Password123!', json: 'true' }) })
const adminCk = [ck, ...r2.headers.getSetCookie().map(x => x.split(';')[0])].join('; ')
const adminList = await j('/api/admin/halloween/entries', { headers: { cookie: adminCk } })
const adminRows = adminList.d?.entries ?? []
const anaRow = adminRows.find((x) => x.contactEmail === 'ana@example.com')
const anonRow = adminRows.find((x) => x.id === anonId)
check('admin lists Ana row with private email', !!anaRow, `-> ${adminList.r.status}`)
check('admin lists anon row with null contact name+email', !!anonRow && anonRow.contactName === null && anonRow.contactEmail === null, JSON.stringify(anonRow && { cn: anonRow.contactName, ce: anonRow.contactEmail }))
const minimalRow = adminRows.find((x) => x.id === minimalId)
check('admin lists minimal (address-only) row with null displayName + description', !!minimalRow && minimalRow.displayName === null && minimalRow.description === null, JSON.stringify(minimalRow && { dn: minimalRow.displayName, desc: minimalRow.description }))
check('admin page renders', (await j('/dashboard/halloween', { headers: { cookie: adminCk } })).r.status === 200)
const noPin = await j(`/api/admin/halloween/entries/${id}`, { method: 'PATCH', headers: { cookie: adminCk, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'APPROVED' }) })
check('cannot approve without a pin', noPin.r.status === 400, noPin.t.slice(0, 80))
const ok = await j(`/api/admin/halloween/entries/${id}`, { method: 'PATCH', headers: { cookie: adminCk, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'APPROVED', latitude: 33.94251, longitude: -117.22977 }) })
check('approve with pin', ok.r.status === 200, ok.t.slice(0, 80))

// public view
list = await j('/api/halloween/entries')
const e = list.d?.entries?.[0]
check('approved entry public', list.d?.entries?.length === 1 && e?.displayName === 'The Garcia Graveyard')
check('public pin is blurred', e?.latitude === 33.943 && e?.longitude === -117.23, `${e?.latitude},${e?.longitude}`)
check('public label hides house number', e?.locationLabel === 'Near Elm St', e?.locationLabel)
const raw = list.t
check('no private data leaked', !/ana@example|9515550100|Garcia"|1234|contactEmail|streetAddress|ipHash/.test(raw.replace('The Garcia Graveyard', '')))
const home = await j('/halloween'); check('SSR page lists the home', home.t.includes('Garcia Graveyard'))

// voting
const v = (headers = {}) => j('/api/halloween/vote', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ entryId: id }) })
const v1 = await v({ 'cf-connecting-ip': '203.0.113.10' })
check('first vote counts', v1.r.status === 200 && v1.d?.votes === 1, v1.t.slice(0, 100))
const cookie = v1.r.headers.getSetCookie().map(x => x.split(';')[0]).find(x => x.startsWith('mv_hv='))
check('device cookie issued', !!cookie)
const v2 = await v({ 'cf-connecting-ip': '203.0.113.10', cookie }); check('same device+ip blocked', v2.r.status === 409 && v2.d?.votes === 1)
const v3 = await v({ 'cf-connecting-ip': '203.0.113.99', cookie }); check('same device, new ip blocked', v3.r.status === 409)
const v4 = await v({ 'cf-connecting-ip': '203.0.113.10' }); check('new device, same ip blocked', v4.r.status === 409)
const v5 = await v({ 'cf-connecting-ip': '203.0.113.55' }); check('different person can vote', v5.r.status === 200 && v5.d?.votes === 2, v5.t.slice(0, 100))
const par = await Promise.all([1, 2, 3, 4, 5].map(() => v({ 'cf-connecting-ip': '203.0.113.200', cookie: 'mv_hv=' + 'a'.repeat(32) + '.' + 'b'.repeat(32) })))
check('forged cookie falls through to captcha path (dev skips) - only one concurrent vote counts', par.filter(x => x.r.status === 200).length === 1, par.map(x => x.r.status).join(','))
const forgedWorks = await j('/api/halloween/vote', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.201' }, body: JSON.stringify({ entryId: 'nope' }) })
check('unknown home 404', forgedWorks.r.status === 404)
list = await j('/api/halloween/entries', { headers: { cookie, 'cf-connecting-ip': '203.0.113.10' } })
check('voted ids reported for device', list.d?.votedIds?.includes(id) && list.d?.entries?.[0]?.votes === 3, JSON.stringify(list.d?.votedIds) + ' votes=' + list.d?.entries?.[0]?.votes)

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURE(S)`)
if (fails) console.log('---- server log tail\n' + log.slice(-3000))
srv.kill('SIGKILL'); await pg.stop(); fs.rmSync(dir, { recursive: true, force: true })
process.exit(fails ? 1 : 0)
