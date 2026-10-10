import EmbeddedPostgres from 'embedded-postgres'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PORT = 54329

let pg: EmbeddedPostgres | undefined
let dir: string | undefined

export async function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moval-pg-'))
  pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'test',
    password: 'test',
    port: PORT,
    persistent: false,
  })
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('moval_test')

  // Build the schema from the Drizzle schema itself (not from Prisma).
  const ddl = execSync('npx drizzle-kit export --sql --config drizzle.config.ts', {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgres://unused:unused@localhost:1/unused' },
  })
    .split('\n')
    .filter((l) => !l.startsWith('◇'))
    .join('\n')

  const client = pg.getPgClient('moval_test')
  await client.connect()
  await client.query(ddl)
  await client.end()

  process.env.DATABASE_URL = `postgres://test:test@localhost:${PORT}/moval_test`
}

export async function teardown() {
  await pg?.stop()
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
}
