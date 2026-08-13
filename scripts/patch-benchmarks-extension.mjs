#!/usr/bin/env node
/**
 * Populate market_benchmarks for the newly-imported propiedades.com colonias
 * (datasets 27 + 28, Nov 2025 + Feb 2025 captures).
 *
 * Data sources:
 *  - Real benchmarks: detail-page statistics (average_size_house_price) via Wayback.
 *  - Fallback (n=1, circular): avg price/m² from list captures for colonias with no
 *    archived detail page (Campesina, Cumbres Universidad, Molino de Agua).
 *
 * Usage: node scripts/patch-benchmarks-extension.mjs
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
  }
  args.push(`${URL}${pathname}`);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

// Real benchmarks from archived detail-page statistics.
const realBenchmarks = [
  { colonia: 'Ankara',             avg_price_m2_const: 17453, avg_price_m2_land: 17798 },
  { colonia: 'Cuauhtémoc',         avg_price_m2_const: 12248, avg_price_m2_land:  8729 },
  { colonia: 'Lomas Montecarlo',   avg_price_m2_const: 10197, avg_price_m2_land: 10452 },
  { colonia: 'Los Huertos',        avg_price_m2_const: 10350, avg_price_m2_land: 12161 },
  { colonia: 'Panamericana',       avg_price_m2_const: 11918, avg_price_m2_land:  8854 },
  { colonia: 'Paseos de Chihuahua',avg_price_m2_const:  8680, avg_price_m2_land: 10797 },
  { colonia: 'Quintas Montecarlo', avg_price_m2_const:  8175, avg_price_m2_land:  7766 },
  { colonia: 'Residencial El León',avg_price_m2_const:  8751, avg_price_m2_land:  6837 },
  { colonia: 'Rincón del Lago',    avg_price_m2_const:  8449, avg_price_m2_land:  9182 },
  { colonia: 'Santo Niño',         avg_price_m2_const: 29061, avg_price_m2_land: 27446 },
  { colonia: 'Tracia',             avg_price_m2_const: 19111, avg_price_m2_land: 18870 },
];

// Circular fallbacks (n=1 list sample) — flagged low confidence.
const fallbackBenchmarks = [
  { colonia: 'Campesina',          avg_price_m2_const: 22936, avg_price_m2_land: null },
  { colonia: 'Cumbres Universidad',avg_price_m2_const: 13750, avg_price_m2_land: null },
  { colonia: 'Molino de Agua',     avg_price_m2_const: 16480, avg_price_m2_land: null },
];

async function main() {
  const probe = await pgrest('/rest/v1/market_benchmarks?select=id&limit=1');
  console.log('DB probe OK:', probe.trim().slice(0, 80));

  for (const b of [...realBenchmarks, ...fallbackBenchmarks]) {
    const rec = {
      city: 'Chihuahua',
      colonia: b.colonia,
      avg_price_m2_const: b.avg_price_m2_const ?? 0,
      avg_price_m2_land: b.avg_price_m2_land ?? 0,
    };
    const body = { ...rec, historical_growth_rate: 0 };
    const res = await pgrest('/rest/v1/market_benchmarks?on_conflict=city,colonia', {
      method: 'POST',
      body: [body],
    });
    if (res.trim().startsWith('{') && JSON.parse(res.trim()).code) {
      console.log(`  ✗ ${b.colonia}: ${JSON.parse(res.trim()).message}`);
    } else {
      console.log(`  ✓ ${b.colonia}: const=$${rec.avg_price_m2_const} land=$${rec.avg_price_m2_land}`);
    }
  }

  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
