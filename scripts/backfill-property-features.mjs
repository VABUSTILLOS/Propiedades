#!/usr/bin/env node
/**
 * Backfill feature fields (recámaras, baños, m² terreno/lote, m² construido,
 * estacionamientos, antigüedad) on Vivanuncios properties.
 *
 * Sources, in priority order:
 *   1. Crawl output (authoritative detail-page data): a JSON-lines file
 *      produced by the property_detail spider:
 *        uv run scrapy crawl property_detail -O out.jl
 *      Matched to DB rows by the trailing listing ID in source_url.
 *   2. Title regex (fallback for fields the crawl couldn't extract): parses
 *      recámaras / estacionamientos / m² from the listing title.
 *
 * Idempotent: crawl values are authoritative and applied whenever present;
 * title-regex values only fill fields that are currently NULL unless `--force`
 * is passed.
 *
 * Usage:
 *   node scripts/backfill-property-features.mjs [items.jl] [--dry-run] [--force]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local — fall back to ambient env vars.
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const args = process.argv.slice(2);
const itemsPath = args.find((a) => /\.(jl|jsonl)$/.test(a));
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

/** Parse an int, returning null for undefined/null/NaN. */
function toInt(v) {
  if (v === undefined || v === null) return null;
  const n = Number.parseInt(String(v).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** Extract numeric features from a listing title (e.g. "3 Recámaras", "2 Estacionamientos", "184m²"). */
function featuresFromTitle(title) {
  if (!title) return {};
  const out = {};
  const rec = title.match(/(\d+)\s*[Rr]ecámaras?/);
  if (rec) out.recamaras = toInt(rec[1]);
  const estac = title.match(/(\d+)\s*[Ee]stacionamientos?/);
  if (estac) out.estacionamientos = toInt(estac[1]);
  const banos = title.match(/(\d+)\s*baños?/i);
  if (banos) out.banos = toInt(banos[1]);
  const m2 = title.match(/(\d+(?:[\d,.]*))\s*m²/i);
  if (m2) {
    const v = toInt(m2[1].replace(/,/g, ""));
    if (v !== null) {
      out.terreno_m2 = v;
      out.construccion_m2 = v;
    }
  }
  return out;
}

const byVivId = new Map();
if (itemsPath) {
  if (!fs.existsSync(itemsPath)) {
    console.error(`Items file not found: ${itemsPath}`);
    process.exit(1);
  }
  const items = fs
    .readFileSync(itemsPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  for (const it of items) {
    const vivId = it.url?.match(/(\d+)\/?$/)?.[1] ?? it.source_url?.match(/(\d+)\/?$/)?.[1];
    if (!vivId) continue;
    byVivId.set(vivId, it);
  }
  console.log(`Crawl items: ${items.length}, with listing ID: ${byVivId.size}`);
}

async function fetchAll() {
  const rows = [];
  for (let page = 0; ; page++) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=id,source_url,title,recamaras,banos,terreno_m2,construccion_m2,estacionamientos,antiguedad&source_url=ilike.*vivanuncios*&order=id&limit=1000&offset=${page * 1000}`,
      { headers },
    );
    if (!r.ok) throw new Error(`GET failed: ${r.status} ${await r.text()}`);
    const batch = await r.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

async function updateRow(row, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${row.id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`PATCH ${row.id} failed: ${r.status} ${await r.text()}`);
}

const FIELDS = [
  "recamaras",
  "banos",
  "terreno_m2",
  "construccion_m2",
  "estacionamientos",
  "antiguedad",
];

async function main() {
  const rows = await fetchAll();
  console.log(`DB rows: ${rows.length} vivanuncios properties`);

  let updated = 0;
  let dryPatches = 0;
  const coverage = { recamaras: 0, banos: 0, terreno_m2: 0, construccion_m2: 0, estacionamientos: 0, antiguedad: 0 };

  for (const row of rows) {
    const vivId = row.source_url?.match(/(\d+)\/?$/)?.[1];
    const item = vivId ? byVivId.get(vivId) : null;
    const fromTitle = featuresFromTitle(row.title);

    const patch = {};
    for (const f of FIELDS) {
      const crawlValue = item ? toInt(item[f]) : null;
      const titleValue = fromTitle[f] ?? null;
      let newValue;
      if (crawlValue !== null) {
        newValue = crawlValue; // authoritative
      } else if (titleValue !== null && (force || row[f] === null)) {
        newValue = titleValue; // fallback, only fills NULL unless --force
      } else {
        continue;
      }
      if (newValue !== row[f]) patch[f] = newValue;
    }

    if (Object.keys(patch).length === 0) continue;
    for (const f of Object.keys(patch)) coverage[f]++;
    if (dryRun) {
      dryPatches++;
      console.log(
        `  ~ ${row.id.slice(0, 8)} ${vivId ?? "?"} → ${FIELDS.filter((f) => patch[f] !== undefined).map((f) => `${f}=${patch[f]}`).join(" · ")}`,
      );
      continue;
    }
    await updateRow(row, patch);
    updated++;
    console.log(
      `  ✓ ${row.id.slice(0, 8)} ${vivId ?? "?"} → ${FIELDS.filter((f) => patch[f] !== undefined).map((f) => `${f}=${patch[f]}`).join(" · ")}`,
    );
  }

  console.log(dryRun ? `Dry run: ${dryPatches} rows would be patched.` : `Done: ${updated} rows patched.`);
  console.log("Field coverage (rows patched):");
  for (const f of FIELDS) console.log(`  ${f}: ${coverage[f]}/${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
