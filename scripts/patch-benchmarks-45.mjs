#!/usr/bin/env node
/**
 * patch-benchmarks-45.mjs — upsert the market_benchmarks for colonias that
 * first appeared in dataset-45 (2019 ?pagina=N captures).
 *
 * Methodology (established): avg price/m² per colonia computed from DB samples
 * (price ÷ size). const = avg for non-terreno categories (construccion_m2);
 * land = avg for terreno (terreno_m2). Both are stored when present (the
 * semáforo RPC reads avg_price_m2_const; AVM reads both). Historical growth
 * rate = 0.
 *
 * Run: node scripts/patch-benchmarks-45.mjs
 */
import fs from 'node:fs';
process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const curated = JSON.parse(fs.readFileSync('/tmp/new-bench-45.json', 'utf8'));
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates',
};
(async () => {
  let ok = 0, fail = 0;
  for (const c of curated) {
    const body = {
      city: 'Chihuahua',
      colonia: c.colonia,
      avg_price_m2_const: c.avg_price_m2_const ?? 0,
      avg_price_m2_land: c.avg_price_m2_land ?? 0,
      historical_growth_rate: 0,
    };
    const r = await fetch(url + '/rest/v1/market_benchmarks?on_conflict=city,colonia', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (r.ok) { ok++; console.log(`${c.colonia}: ${r.status} OK`); }
    else { fail++; console.log(`${c.colonia}: ${r.status} ${await r.text()}`); }
  }
  console.log(`\nOK: ${ok} · Failed: ${fail}`);
})();
