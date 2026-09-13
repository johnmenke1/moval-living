import { readFileSync } from 'node:fs'
const lines = readFileSync('./.env.local', 'utf8').split('\n')
const get = (k) => {
  const l = lines.find((x) => x.startsWith(k + '='))
  if (!l) return ''
  return l.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '')
}
const url = process.env.DATABASE_URL || get('DATABASE_URL')
try {
  const u = new URL(url.replace(/^postgres:/, 'http:'))
  console.log(JSON.stringify({ host: u.hostname, dbname: u.pathname.slice(1), user: u.username }, null, 2))
} catch (e) {
  console.log('parse err', e.message, 'url-prefix=', url.slice(0, 60))
}