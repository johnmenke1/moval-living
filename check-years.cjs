const{ Pool }=require('pg');
const p=new Pool({connectionString:'postgresql://neondb_owner:npg_RCJWsx5bg1nH@ep-summer-surf-afffty47-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require'});
async function main(){
  // Get the Best Tacos entry for Loco Burrito
  const r=await p.query("SELECT be.id,be.\"yearsActive\",b.\"createdAt\",bc.name as cat FROM \"BestOfEntry\" be JOIN \"BestOfCategory\" bc ON bc.id=be.\"categoryId\" JOIN \"Business\" b ON b.id=be.\"businessId\" WHERE b.name='Loco Burrito' AND bc.slug='best-tacos'");
  console.log('Loco Burrito Best Tacos entry:');
  r.rows.forEach(x=>console.log(' EntryID:',x.id,'yearsActive:',x.yearsActive,'Business createdAt:',x.createdAt,'Category:',x.cat));
  
  // Get the BestOfScore for yearsActive for this entry
  const scores=await p.query("SELECT factor,\"rawValue\" FROM \"BestOfScore\" WHERE \"entryId\"=$1 AND factor='yearsActive'",[r.rows[0].id]);
  console.log('\nyearsActive BestOfScore:');
  scores.rows.forEach(x=>console.log(' ',x.factor,':',x.rawValue));
  
  // Also check maxYears by looking at all entries in Best Tacos category
  const maxY=await p.query("SELECT max(be.\"yearsActive\") as max_years FROM \"BestOfEntry\" be JOIN \"BestOfCategory\" bc ON bc.id=be.\"categoryId\" WHERE bc.slug='best-tacos'");
  console.log('\nMax yearsActive in Best Tacos category:',maxY.rows[0].max_years);
  
  await p.end();
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message.split('\n')[0]);process.exit(1)})
