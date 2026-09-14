
process.env.DATABASE_URL = process.env.DATABASE_URL;
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const rows = await c.query(`
    SELECT b.id as business_id, b.coupon, d.id as deal_id,
           d."imageUrl" as deal_imageurl,
           d.code as deal_code,
           d."expiresAt" as deal_expiresat
    FROM "Business" b
    LEFT JOIN "Deal" d ON d."businessId" = b.id
    WHERE b.coupon IS NOT NULL AND d.id IS NOT NULL
  `);

  let imageFixes = 0, codeFixes = 0, expiresFixes = 0;
  for (const r of rows.rows) {
    const coupon = r.coupon;
    const updates = [];
    const vals = [];
    let i = 1;
    if (coupon.imageUrl && !r.deal_imageurl) { updates.push(`"imageUrl" = $${i++}`); vals.push(coupon.imageUrl); imageFixes++; }
    if (coupon.code && !r.deal_code) { updates.push(`code = $${i++}`); vals.push(coupon.code); codeFixes++; }
    if (coupon.expiresAt && !r.deal_expiresat) { updates.push(`"expiresAt" = $${i++}`); vals.push(coupon.expiresAt); expiresFixes++; }
    if (updates.length > 0) {
      vals.push(r.deal_id);
      await c.query(`UPDATE "Deal" SET ${updates.join(', ')} WHERE id = $${i}`, vals);
      console.log(`Updated deal ${r.deal_id}: ${updates.join(', ')}`);
    }
  }
  console.log(`\nTotals: imageFixes=${imageFixes}, codeFixes=${codeFixes}, expiresFixes=${expiresFixes}`);

  const verify = await c.query(`
    SELECT b.slug, d."imageUrl", d.headline
    FROM "Business" b
    JOIN "Deal" d ON d."businessId" = b.id
    WHERE b.slug LIKE '%secdu%'
  `);
  console.log('\nSECDU post-backfill:', JSON.stringify(verify.rows, null, 2));
  await c.end();
})();
