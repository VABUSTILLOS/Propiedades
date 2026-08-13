#!/usr/bin/env node
/**
 * Populate market_benchmarks for Chihuahua colonias and patch construccion_m2/terreno_m2
 * on the 21 imported propiedades.com properties so the semáforo (compute_colonia_discount)
 * can score them.
 *
 * Data sources:
 *  - Real benchmarks: __NEXT_DATA__.statistics on captured detail pages (per-colonia avg $/m²)
 *  - Fallback benchmarks: avg price/m² computed from list captures (≤$3M filter) for colonias
 *    with no Wayback capture of statistics.
 *  - Sizes: detail-page size_house/size_ground where available; otherwise list-capture size_m2
 *    (which equals size_house for Casas/Departamentos) and terreno size for Terrenos.
 *
 * Usage: node scripts/patch-benchmarks.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ---- load env ----
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
  } else if (method === 'PATCH') {
    args.push('-X', 'PATCH', '-H', 'Content-Type: application/json', '-H', 'Prefer: return=minimal');
    if (opts.body) args.push('-d', JSON.stringify(opts.body));
  }
  args.push(`${URL}${pathname}`);
  // execFileSync passes args as an array (no shell word-splitting), so header
  // values containing spaces ("Authorization: Bearer <key>") stay intact.
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  return out;
}

// ============================================================================
// 1. BENCHMARKS
// ============================================================================
// Real benchmarks extracted from detail-page statistics (latest capture wins).
const realBenchmarks = [
  { colonia: 'Monteverde',            avg_price_m2_const: 15396, avg_price_m2_land: 16825 },
  { colonia: 'Colinas del Valle',     avg_price_m2_const: 11147, avg_price_m2_land: 11466 },
  { colonia: 'Romanzza',              avg_price_m2_const:  8457, avg_price_m2_land:  8034 },
  { colonia: 'Diamante Reliz',        avg_price_m2_const: 15540, avg_price_m2_land: 14886 },
  { colonia: 'La Haciendita',         avg_price_m2_const: 17771, avg_price_m2_land: 18996 },
  { colonia: 'Bosques del Valle',     avg_price_m2_const: 14405, avg_price_m2_land: 16133 },
  { colonia: 'Campo Bello',           avg_price_m2_const:  9837, avg_price_m2_land: 11528 },
  { colonia: 'Misión del Valle',      avg_price_m2_const: 14938, avg_price_m2_land: 13956 },
  { colonia: 'Lomas del Santuario II Etapa', avg_price_m2_const: 15037, avg_price_m2_land: 11696 },
];

// Fallback benchmarks computed from list captures (≤$3M filter), only for colonias
// that the imported properties live in and that have no real benchmark.
const fallbackBenchmarks = [
  { colonia: 'Ciudad Universitaria',           avg_price_m2_const: null, avg_price_m2_land:  2667 },
  { colonia: 'Lomas Altas V',                  avg_price_m2_const: null, avg_price_m2_land:  7968 },
  { colonia: 'Arquitos',                       avg_price_m2_const: 31765, avg_price_m2_land: null },
  { colonia: 'Provincia de Santa Clara Etapa I a La XII', avg_price_m2_const: 19366, avg_price_m2_land: null },
  { colonia: 'Los Pinos',                      avg_price_m2_const: 14773, avg_price_m2_land: null },
  { colonia: 'Santa Rosa',                     avg_price_m2_const: 21739, avg_price_m2_land: null },
  { colonia: 'Seratta 36',                     avg_price_m2_const: 20896, avg_price_m2_land: null },
  { colonia: 'Bosques de San Pedro',           avg_price_m2_const: 15372, avg_price_m2_land: null },
  { colonia: 'Puente de Piedra',               avg_price_m2_const: 21831, avg_price_m2_land: null },
  { colonia: 'Mirador',                        avg_price_m2_const: 19226, avg_price_m2_land: null },
  { colonia: 'Junta de los Ríos y Etapas',     avg_price_m2_const: 11583, avg_price_m2_land: null },
];

// ============================================================================
// 2. SIZE PATCHES for the 21 imported properties (by listing_id_propiedades)
// ============================================================================
// construccion_m2: size_house (detail) or size_m2 (list) for Casas/Departamentos.
// terreno_m2: size_ground (detail) for houses; size_m2 for Terrenos.
const sizePatches = [
  { listing_id_propiedades: '30768459', construccion_m2: 0,    terreno_m2: 450 },  // Terreno habitacional
  { listing_id_propiedades: '30182874', construccion_m2: 115,  terreno_m2: 0 },
  { listing_id_propiedades: '30907768', construccion_m2: 0,    terreno_m2: 251 },  // Terreno habitacional
  { listing_id_propiedades: '30182875', construccion_m2: 121,  terreno_m2: 126 },  // detail house=121 ground=126
  { listing_id_propiedades: '30036276', construccion_m2: 68,   terreno_m2: 0 },    // Departamento
  { listing_id_propiedades: '30120088', construccion_m2: 98,   terreno_m2: 120 },  // detail house=98 ground=120
  { listing_id_propiedades: '30177804', construccion_m2: 105,  terreno_m2: 0 },
  { listing_id_propiedades: '31021722', construccion_m2: 122,  terreno_m2: 0 },
  { listing_id_propiedades: '30243852', construccion_m2: 176,  terreno_m2: 0 },
  { listing_id_propiedades: '29295885', construccion_m2: 115,  terreno_m2: 0 },
  { listing_id_propiedades: '29808281', construccion_m2: 149,  terreno_m2: 0 },
  { listing_id_propiedades: '30910426', construccion_m2: 134,  terreno_m2: 0 },
  { listing_id_propiedades: '29808282', construccion_m2: 138,  terreno_m2: 0 },
  { listing_id_propiedades: '30744674', construccion_m2: 188,  terreno_m2: 0 },
  { listing_id_propiedades: '31066176', construccion_m2: 152,  terreno_m2: 0 },
  { listing_id_propiedades: '29455656', construccion_m2: 121,  terreno_m2: 0 },
  { listing_id_propiedades: '30247406', construccion_m2: 120,  terreno_m2: 0 },
  { listing_id_propiedades: '30655577', construccion_m2: 155,  terreno_m2: 0 },
  { listing_id_propiedades: '30180120', construccion_m2: 130,  terreno_m2: 175 },  // detail house=130 ground=175
  { listing_id_propiedades: '30175614', construccion_m2: 0,    terreno_m2: 0 },    // no size data available
  { listing_id_propiedades: '30003695', construccion_m2: 259,  terreno_m2: 0 },
];

async function main() {
  // ---- verify connectivity ----
  const probe = await pgrest('/rest/v1/market_benchmarks?select=id&limit=1');
  console.log('DB probe OK:', probe.trim().slice(0, 80));

  // ---- insert real benchmarks (upsert on city+colonia) ----
  console.log('\nInserting benchmarks…');
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

  // ---- patch sizes ----
  console.log('\nPatching construccion_m2 / terreno_m2…');
  for (const p of sizePatches) {
    const res = await pgrest(`/rest/v1/properties?source_name=eq.propiedades&listing_id_propiedades=eq.${p.listing_id_propiedades}`, {
      method: 'PATCH',
      body: { construccion_m2: p.construccion_m2, terreno_m2: p.terreno_m2 },
    });
    console.log(`  ✓ ${p.listing_id_propiedades}: const=${p.construccion_m2} terr=${p.terreno_m2}`);
  }

  // ---- verify ----
  console.log('\nVerifying: rows with precio_m2_const populated…');
  const check = await pgrest('/rest/v1/properties?select=listing_id_propiedades,price,construccion_m2,precio_m2_const,colonia&source_name=eq.propiedades&limit=25');
  for (const r of JSON.parse(check)) {
    console.log(`  ${r.listing_id_propiedades}: ${r.colonia} price=$${r.price} const=${r.construccion_m2} -> precio_m2_const=${r.precio_m2_const ?? 'NULL'}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
