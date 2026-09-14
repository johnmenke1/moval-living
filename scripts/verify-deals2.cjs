
process.env.DATABASE_URL = process.env.DATABASE_URL;
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Real "has a deal worth migrating" rows:
  //   hasCoupon = true AND coupon has at least headline OR imageUrl
  const rows = await c.query(`
    SELECT b.id, b.slug, b."hasCoupon", b.coupon,
           d.id as deal_id, d."imageUrl", d.headline, d.code, d."expiresAt"
    FROM "Business" b
    LEFT JOIN "Deal" d ON d."businessId" = b.id
    WHERE b."hasCoupon" = true
  `);
  console.log('Total hasCoupon=true:', rows.rows.length);
  console.log('\nWith Deal rows:');
  for (const r of rows.rows.filter(x => x.deal_id)) {
    const c = r.coupon || {};
    const cHeadline = c.headline || null;
    const cImage = c.imageUrl || null;
    const cCode = c.code || null;
    const cExpires = c.expiresAt || null;
    console.log(`  ${r.slug}: deal.headline=${r.headline} deal.imageUrl=${r.imageUrl ? 'YES' : 'NULL'} | legacy.headline=${cHeadline} legacy.imageUrl=${cImage ? 'YES' : 'NULL'}`);
  }
  console.log('\nWITHOUT Deal rows (would lose data on drop):');
  for (const r of rows.rows.filter(x => !x.deal_id)) {
    const c = r.coupon || {};
    console.log(`  ${r.slug}: headline=${c.headline || '(none)'} imageUrl=${c.imageUrl || '(none)'}`);
  }
  await c.end();
})();
