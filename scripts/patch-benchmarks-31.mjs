#!/usr/bin/env node
/**
 * Populate market_benchmarks for the 69 newly-imported propiedades.com colonias
 * (dataset 31) that lacked benchmark coverage.
 *
 * Source: captured list-card price/m² samples (price / size_m2), dedup'd per pid,
 * computed in benchmark-compute-tmp.mjs → /tmp/benchmark-final.json.
 *
 * CDX hunts (exact detail URLs AND wildcard colonia patterns) found NO archived
 * detail pages for these colonias, so the real "Precio por/m² promedio en la
 * colonia" field is unavailable — card-based fallbacks are the only source.
 *
 * Value selection:
 *  - multi-sample sane    → avg or fAvg (outlier-filtered mean)
 *  - n=1 circular         → the single sample (low confidence)
 *  - dubious filtered     → manually overridden to the plausible sample
 *
 * Usage: node scripts/patch-benchmarks-31.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const env = {};
for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function pgrest(pathname, opts = {}) {
  const method = opts.method || 'GET';
  const args = [
    'curl', '-s', '--max-time', '60',
    '-H', `apikey: ${KEY}`,
    '-H', `Authorization: Bearer ${KEY}`,
  ];
  if (method === 'POST') {
    args.push('-X', 'POST', '-H', 'Content-Type: application/json');
    if (opts.body) args.push('-d', JSON.stringify(opts.body));
    if (opts.headers) for (const [k, v] of Object.entries(opts.headers)) args.push('-H', `${k}: ${v}`);
  }
  args.push(`${URL}${pathname}`);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

async function main() {
  const probe = await pgrest('/rest/v1/market_benchmarks?select=id&limit=1');
  console.log('DB probe OK:', probe.trim().slice(0, 80));

  const curated = JSON.parse(fs.readFileSync('/tmp/benchmark-final.json', 'utf8'));
  const payload = Object.entries(curated).map(([colonia, avg_price_m2_const]) => ({
    city: 'Chihuahua',
    colonia,
    avg_price_m2_const,
    avg_price_m2_land: 0,
    historical_growth_rate: 0,
  }));

  const res = await pgrest('/rest/v1/market_benchmarks?on_conflict=city,colonia', {
    method: 'POST',
    body: payload,
    headers: { Prefer: 'resolution=merge-duplicates' },
  });
  console.log('Upsert result:', res.slice(0, 300));
  console.log(`Total benchmarks in payload: ${payload.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
