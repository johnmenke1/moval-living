const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  console.log('TABLES:');
  tables.rows.forEach(r => console.log('  ', r.tablename));
  console.log('---');
  const sectionTables = tables.rows.filter(r => r.tablename.toLowerCase().includes('section'));
  if (sectionTables.length) {
    for (const t of sectionTables) {
      const r = await client.query(`SELECT * FROM "${t.tablename}" LIMIT 20`);
      console.log(`\n${t.tablename} (${r.rows.length} rows):`);
      r.rows.forEach(row => console.log('  ', JSON.stringify(row)));
    }
  } else {
    console.log('No *Section* tables found.');
  }
  const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='BestOfCategory' ORDER BY ordinal_position`);
  console.log('\nBestOfCategory columns:');
  cols.rows.forEach(r => console.log('  ', r.column_name, ':', r.data_type));
  console.log('\nBestOfCategory rows:');
  const all = await client.query(`SELECT * FROM "BestOfCategory" ORDER BY "sortOrder"`);
  all.rows.forEach(r => console.log('  ', JSON.stringify(r)));
  await client.end();
})().catch(e => { console.error(e.message); process.exit(1); });
