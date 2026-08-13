#!/usr/bin/env node
/**
 * Populate market_benchmarks for the 18 newly-imported propiedades.com colonias
 * (dataset 30, Feb 2025 truncated list captures) that lacked benchmark coverage.
 *
 * Data sources:
 *  - Real benchmarks (archived detail-page colonia statistics, average_size_house_price):
 *    - Los Naranjos        $6,493/m² const (2025-05-13, detail-29598874)
 *    - Rigoberto Quiroz    $5,038/m² const (2023-03-23, detail-19180331)
 *    - Rincón Colonial     $7,795/m² const (2025-05-22, detail-29448949)
 *  - Real benchmarks (multi-sample avg of captured list-card price/m²):
 *    - Chihuahua I         $21,388/m² const (n=3: 29037046=22750, 29112846=18556, 30307201=22857)
 *    - Fracc. P. Santa Clara $19,355/m² const (n=5 real Santa Clara samples)
 *  - Fallback (n=1, circular — flagged low confidence):
 *    - Jardines del Sol $10,433 · Rincón de Los Huertos $7,770 · Rinconadas de la Sierra $6,973 ·
 *      2 de Octubre y Ampliación $7,800 · Tierra y Libertad $16,667 · Miguel Hidalgo $9,000 ·
 *      Adelitas I $8,097 · Lomas Vallarta $12,228 · Ática $23,984
 *
 * Usage: node scripts/patch-benchmarks-30.mjs
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

const realBenchmarks = [
  { colonia: 'Los Naranjos',                  avg_price_m2_const:  6493, avg_price_m2_land: null },
  { colonia: 'Rigoberto Quiroz',              avg_price_m2_const:  5038, avg_price_m2_land: null },
  { colonia: 'Rincón Colonial',               avg_price_m2_const:  7795, avg_price_m2_land: null },
  { colonia: 'Chihuahua I',                   avg_price_m2_const: 21388, avg_price_m2_land: null },
  { colonia: 'Fraccionamiento Provincia de Santa Clara', avg_price_m2_const: 19355, avg_price_m2_land: null },
];

const fallbackBenchmarks = [
  { colonia: 'Jardines del Sol',              avg_price_m2_const: 10433, avg_price_m2_land: null },
  { colonia: 'Rincón de Los Huertos',         avg_price_m2_const:  7770, avg_price_m2_land: null },
  { colonia: 'Rinconadas de la Sierra',       avg_price_m2_const:  6973, avg_price_m2_land: null },
  { colonia: '2 de Octubre y Ampliación',     avg_price_m2_const:  7800, avg_price_m2_land: null },
  { colonia: 'Tierra y Libertad',             avg_price_m2_const: 16667, avg_price_m2_land: null },
  { colonia: 'Miguel Hidalgo',                avg_price_m2_const:  9000, avg_price_m2_land: null },
  { colonia: 'Adelitas I',                    avg_price_m2_const:  8097, avg_price_m2_land: null },
  { colonia: 'Lomas Vallarta',                avg_price_m2_const: 12228, avg_price_m2_land: null },
  { colonia: 'Ática',                         avg_price_m2_const: 23984, avg_price_m2_land: null },
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
      headers: { Prefer: 'resolution=merge-duplicates' },
    });
    const trimmed = res.trim();
    console.log(`upsert ${b.colonia}:`, trimmed ? trimmed.slice(0, 120) : '(no body)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
