import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config() // .env
config({ path: '.env.local' }) // overrides, same convention as prisma.config.ts

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
