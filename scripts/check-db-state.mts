import { getPrisma } from '../src/lib/prisma.ts';
const p = getPrisma();
const all: any = await p.$queryRawUnsafe(
  `SELECT migration_name, finished_at, started_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at`
);
console.log('All migrations in _prisma_migrations:');
for (const m of all) console.log('  ' + m.migration_name + ' — finished: ' + (m.finished_at?.toISOString() ?? 'NULL') + ' — steps: ' + m.applied_steps_count);
await p.$disconnect();