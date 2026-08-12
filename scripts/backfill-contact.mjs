#!/usr/bin/env node
/**
 * Backfill contact data (agency name + phone) onto existing Vivanuncios rows.
 *
 * Sources of contact info, in order:
 *   1. `/tmp/contact_scan2.json` — mapping of 33 remate listing IDs to their
 *      publisher logo URL and any phones found in cached tile text.
 *   2. Description text on each row — MX phones in "614 2 52 38 83" format.
 *
 * Updates are made via the Supabase REST API (service role). Idempotent and
 * safe to re-run — already-populated fields are left untouched unless
 * `--force` is passed.
 *
 * Usage:
 *   node scripts/backfill-contact.mjs [--force] [--scan /tmp/contact_scan2.json]
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
const force = args.includes("--force");
const scanPath =
  args[args.indexOf("--scan") + 1] ?? "/tmp/contact_scan2.json";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

/** Map a Vivanuncios publisher logo slug to a human-readable agency name. */
const AGENCY_NAMES = {
  "gl-bienes-raices": "GL Bienes Raíces",
  "kasar-bienes-raices": "Kasar Bienes Raíces",
  "mitlich-asesores-inmobiliarios": "Mitlich Asesores Inmobiliarios",
  "beall-bienes-raices": "Beall Bienes Raíces",
  "cimex-inmobiliaria-cuu": "CIMEX Inmobiliaria CUU",
  "city-brokers": "City Brokers",
  "iad-mexico": "IAD México",
  "renacer-asesores-inmobiliarios-s-de-rl-de-cv": "Renacer Asesores Inmobiliarios",
  "w-real-estate": "W Real Estate",
};

function agencyFromLogo(logo) {
  if (!logo) return null;
  const slug = logo.match(/logo_([a-z0-9-]+)_\d+\.jpg/)?.[1];
  if (!slug) return null;
  return AGENCY_NAMES[slug] ?? slug.replace(/-/g, " ");
}

/** Normalize a MX phone ("614 2 52 38 83") → "6142523883" or null. */
function extractMxPhone(text) {
  if (!text) return null;
  const m = text.match(/\d{3}\s+\d\s+\d{2}\s+\d{2}\s+\d{2}/);
  return m ? m[0].replace(/\s+/g, "") : null;
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

async function fetchAll() {
  const rows = [];
  for (let page = 0; ; page++) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=id,source_url,description,contact_name,contact_phone&source_url=ilike.*vivanuncios*&order=id&limit=1000&offset=${page * 1000}`,
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
  let scan = [];
  if (fs.existsSync(scanPath)) {
    try {
      scan = JSON.parse(fs.readFileSync(scanPath, "utf8"));
    } catch {
      console.warn(`Warning: could not parse ${scanPath}, ignoring.`);
    }
  }
  const scanMap = new Map(scan.map(([id, info]) => [id, info]));

  const rows = await fetchAll();
  console.log(`Rows: ${rows.length} vivanuncios properties`);

  let updated = 0;
  let alreadySet = 0;
  for (const row of rows) {
    const vivId = row.source_url?.match(/(\d+)\/?$/)?.[1];
    const info = vivId ? scanMap.get(vivId) : null;

    const name =
      agencyFromLogo(info?.logo) ||
      row.contact_name ||
      null;
    const phone =
      info?.phones?.map((p) => extractMxPhone(p)).find(Boolean) ||
      extractMxPhone(row.description) ||
      row.contact_phone ||
      null;

    const patch = {};
    if (name && (force || !row.contact_name)) patch.contact_name = name;
    if (name && (force || !row.contact_name)) patch.contact_type = "inmobiliaria";
    if (phone && (force || !row.contact_phone)) {
      patch.contact_phone = phone;
      patch.contact_whatsapp = phone;
    }

    if (Object.keys(patch).length === 0) {
      if (name || phone) alreadySet++;
      continue;
    }
    await updateRow(row, patch);
    updated++;
    const bits = [name, phone].filter(Boolean).join(" · ");
    console.log(`  ✓ ${row.id.slice(0, 8)} ${vivId ?? row.source_url} → ${bits}`);
  }
  console.log(`Done. Updated ${updated} row(s); ${alreadySet} already had data.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
