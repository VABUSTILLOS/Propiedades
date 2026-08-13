import fs from 'node:fs';
process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const curated = JSON.parse(fs.readFileSync('/tmp/benchmark-curated-40.json', 'utf8'));
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' };
(async () => {
  for (const c of curated) {
    const body = { city: 'Chihuahua', colonia: c.colonia, avg_price_m2_const: c.land ? 0 : c.const ?? 0, avg_price_m2_land: c.land ?? 0, historical_growth_rate: 0 };
    const r = await fetch(url + '/rest/v1/market_benchmarks?on_conflict=city,colonia', { method: 'POST', headers, body: JSON.stringify(body) });
    console.log(`${c.colonia}: ${r.status} ${r.ok ? 'OK' : await r.text()}`);
  }
})();
