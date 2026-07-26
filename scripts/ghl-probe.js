require('dotenv').config({path:'.env.local'});
const tok = process.env.GHL_API_TOKEN, loc = process.env.GHL_LOCATION_ID;
async function probe(p){
  const r=await fetch('https://services.leadconnectorhq.com'+p,{headers:{Authorization:'Bearer '+tok,'Version':'2021-07-28',Accept:'application/json'}});
  const t=await r.text();
  let d; try{d=JSON.parse(t)}catch{d={raw:t.slice(0,300)}};
  return {status:r.status, error:d.error||null,
    locName:d.location?.name||d.name||null,
    keys: typeof d==='object'&&d?Object.keys(d):null,
    counts:{
      contacts:Array.isArray(d.contacts)?d.contacts.length:null,
      tags:Array.isArray(d.tags)?d.tags.length:null,
      workflows:Array.isArray(d.workflows)?d.workflows.length:null,
      lists:Array.isArray(d.lists)?d.lists.length:null,
      customFields:Array.isArray(d.customFields)?d.customFields.length:null,
      campaigns:Array.isArray(d.campaigns)?d.campaigns.length:null,
    },
    sampleWorkflowNames:d.workflows?.slice(0,5)?.map(w=>w.name).filter(Boolean)||null,
    sampleTags:d.tags?.slice(0,8)?.map(t=>t.name).filter(Boolean)||null,
  };
}
(async()=>{
  const out={
    loc:await probe('/locations/'+loc),
    contacts:await probe('/contacts/?locationId='+loc+'&limit=1'),
    lists:await probe('/locations/'+loc+'/lists'),
    workflows:await probe('/workflows/?locationId='+loc),
    tags:await probe('/locations/'+loc+'/tags'),
    customFields:await probe('/locations/'+loc+'/customFields'),
    emailIsv:await probe('/locations/'+loc+'/email/isv'),
    campaigns:await probe('/campaigns/?locationId='+loc),
  };
  console.log(JSON.stringify(out,null,2));
})();
