#!/usr/bin/env node
/**
 * scripts/get-ghl-ids.js — Print pipeline + workflow IDs from GoHighLevel
 *
 * Usage:
 *   node scripts/get-ghl-ids.js <GHL_API_KEY> <GHL_LOCATION_ID>
 *
 * Or set env vars GHL_API_KEY and GHL_LOCATION_ID first.
 *
 * Prints the pipeline ID, every stage ID, and every workflow ID for the
 * location — copy/paste these into your Vercel env vars.
 */

const apiKey = process.argv[2] || process.env.GHL_API_KEY;
const locationId = process.argv[3] || process.env.GHL_LOCATION_ID;

if (!apiKey || !locationId) {
  console.error('Usage: node scripts/get-ghl-ids.js <GHL_API_KEY> <GHL_LOCATION_ID>');
  process.exit(1);
}

async function ghGet(path) {
  const res = await fetch(`https://services.leadconnectorhq.com${path}?locationId=${locationId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: '2021-07-28',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`GET ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    return null;
  }
  return res.json();
}

(async () => {
  console.log('=== Pipelines (all) ===');
  const pipelines = await ghGet('/opportunities/pipelines');
  if (pipelines?.pipelines) {
    for (const p of pipelines.pipelines) {
      const isExpert = p.name.toLowerCase().includes('expert partner');
      console.log(`${isExpert ? '*' : ' '} ${p.id}  ${p.name}`);
      if (isExpert) {
        console.log('   Pipeline ID -> paste into GHL_PIPELINE_ID env var');
        console.log('   Stages:');
        for (const s of (p.stages || [])) {
          const marker = s.name.toLowerCase().includes('new lead') ? ' <- GHL_PIPELINE_STAGE_ID' : '';
          console.log(`     ${s.id}  ${s.name}${marker}`);
        }
      }
    }
  }

  console.log('\n=== Workflows (all) ===');
  const wfRes = await ghGet('/workflows/');
  if (wfRes?.workflows) {
    for (const w of wfRes.workflows) {
      const isExpert = w.name.toLowerCase().includes('expert partner');
      console.log(`${isExpert ? '*' : ' '} ${w.id}  ${w.name}  [${w.status || 'unknown'}]`);
      if (isExpert && w.name.toLowerCase().includes('lead received')) {
        console.log('   ^^^^^ paste this ID into GHL_WORKFLOW_ID env var');
      }
    }
  }

  console.log('\nDone. Copy the marked (*) lines into your Vercel env vars.');
})();
