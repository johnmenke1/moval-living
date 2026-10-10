import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Fast unit tests (`npm test`). Tests that need a real database are named
// *.db.test.ts and run separately via `npm run test:db`.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    exclude: ['**/node_modules/**', '**/.next/**', '**/*.db.test.ts'],
  },
})
