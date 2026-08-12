#!/usr/bin/env node
/**
 * Backfill contact data from the property_detail spider crawl output.
 *
 * Reads a JSON-lines file produced by:
 *   uv run scrapy crawl property_detail -a urls_file=... -O out.jl
 *
 * and PATCHes matching Supabase rows (matched by the trailing listing ID in
 * source_url). Idempotent: already-set fields are left untouched unless
 * `--force` is passed.
 *
 * Usage:
 *   node scripts/backfill-viva-crawl.mjs /tmp/viva_all93_out.jl [--force]
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
const itemsPath = args.find((a) => a.endsWith(".jl"));
const force = args.includes("--force");

if (!itemsPath || !fs.existsSync(itemsPath)) {
  console.error("Usage: node scripts/backfill-viva-crawl.mjs <items.jl> [--force]");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const items = fs
  .readFileSync(itemsPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

console.log(`Items: ${items.length} crawled`);

/** Normalize an MX phone to digits-only ("52 6144663753" → "526144663753"). */
function normPhone(p) {
  if (!p) return null;
  const digits = p.replace(/\D+/g, "");
  if (digits.length < 10) return null; // masked like "+52 6" → too short
  return digits;
}

const byVivId = new Map();
for (const it of items) {
  const vivId = it.url?.match(/(\d+)\/?$/)?.[1] ?? it.source_url?.match(/(\d+)\/?$/)?.[1];
  if (!vivId) continue;
  byVivId.set(vivId, it);
}
console.log(`Items with listing ID: ${byVivId.size}`);

async function fetchAll() {
  const rows = [];
  for (let page = 0; ; page++) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=id,source_url,contact_name,contact_phone,contact_type,contact_methods_available&source_url=ilike.*vivanuncios*&order=id&limit=1000&offset=${page * 1000}`,
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

async function main() {
  const rows = await fetchAll();
  console.log(`DB rows: ${rows.length} vivanuncios properties`);

  let updated = 0;
  let alreadySet = 0;
  let noMatch = 0;
  for (const row of rows) {
    const vivId = row.source_url?.match(/(\d+)\/?$/)?.[1];
    const item = vivId ? byVivId.get(vivId) : null;
    if (!item) {
      noMatch++;
      continue;
    }

    const name = item.agency_name || null;
    const phone = normPhone(item.contact_phone);
    const methods = Array.isArray(item.contact_methods_available)
      ? item.contact_methods_available
      : null;

    const patch = {};
    if (name && (force || !row.contact_name)) {
      patch.contact_name = name;
      patch.contact_type = "inmobiliaria";
    }
    if (phone && (force || !row.contact_phone)) {
      patch.contact_phone = phone;
      patch.contact_whatsapp = phone;
    }
    if (methods && (force || !row.contact_methods_available)) {
      patch.contact_methods_available = methods;
    }

    if (Object.keys(patch).length === 0) {
      if (name || phone || methods) alreadySet++;
      continue;
    }
    await updateRow(row, patch);
    updated++;
    console.log(
      `  ✓ ${row.id.slice(0, 8)} ${vivId} → ${[name, phone, methods?.join("+")].filter(Boolean).join(" · ")}`,
    );
  }
  console.log(`Done: ${updated} updated, ${alreadySet} already set, ${noMatch} rows had no crawled item.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
