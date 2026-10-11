import bcrypt from 'bcryptjs'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../../../src/db/schema'
import * as relations from '../../../src/db/relations'
const { category, owner, business, review } = schema as any
const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema: { ...schema, ...relations } })
const hash = await bcrypt.hash('Password123!', 10)
await db.insert(category).values({ id: 'c1', name: 'Food', slug: 'food', icon: 'x' })
await db.insert(owner).values({ id: 'o1', email: 'test@example.com', name: 'Test Owner', passwordHash: hash, role: 'ADMIN', emailVerified: new Date() })
await db.insert(business).values({ id: 'b1', slug: 'acme', name: 'Acme Diner', description: 'A long enough description for the listing page to render nicely.', categoryId: 'c1', address: '1 Main', city: 'Moreno Valley', state: 'CA', zip: '92553', status: 'APPROVED', ownerId: 'o1', claimedAt: new Date() })
await db.insert(review).values({ businessId: 'b1', authorName: 'Pat', rating: 5, content: 'Great' })
process.exit(0)
