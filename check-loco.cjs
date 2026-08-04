const{Pool}=require('pg');
const p=new Pool({connectionString:'postgresql://neondb_owner:npg_RCJWsx5bg1nH@ep-summer-surf-afffty47-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require'});
p.query("SELECT be.id,bc.name as cat FROM \"BestOfEntry\" be JOIN \"BestOfCategory\" bc ON bc.id=be.\"categoryId\" JOIN \"Business\" b ON b.id=be.\"businessId\" WHERE b.name='Loco Burrito'").then(r=>{console.log('BestOfEntries for Loco Burrito:',r.rows.length);r.rows.forEach(x=>console.log(x.id,x.cat));p.end()}).catch(e=>{console.error(e.message.split('\n')[0]);p.end()})
