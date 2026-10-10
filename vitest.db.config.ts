import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Database integration tests (`npm run test:db`). global-setup starts a
// throwaway Postgres (embedded-postgres), builds the schema from
// src/db/schema.ts, and points DATABASE_URL at it. Never touches a real DB.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['**/*.db.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
    globalSetup: ['tests/db/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
})
