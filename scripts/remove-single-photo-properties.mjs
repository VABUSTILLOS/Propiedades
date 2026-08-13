#!/usr/bin/env node
/**
 * remove-single-photo-properties.mjs — delete properties with 1 or fewer photos.
 *
 * Deletes every row in `properties` where `image_count <= 1` (generated column
 * over `images[]`). This removes the single-photo listings from the catalog so
 * they no longer exist behind direct URLs, dashboards, bids or favorites.
 *
 * Safety:
 *   1. First saves every matching id + title to scripts/removed-single-photo-backup.json
 *   2. Deletes in batches of 200 via the service-role REST API
 *   3. Verifies the remaining counts before and after
 *
 * Usage:
 *   node scripts/remove-single-photo-properties.mjs [--dry-run]
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local — fall back to ambient env vars.
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const ROOT = path.resolve(import.meta.dirname, "..");
const BACKUP_PATH = path.join(ROOT, "scripts", "removed-single-photo-backup.json");

const BATCH = 200;

async function fetchAllIds() {
  const rows = [];
  for (let page = 0; ; page++) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/properties?select=id,title&image_count=lte.1&order=id&limit=1000&offset=${page * 1000}`,
      { headers },
    );
    if (!r.ok) throw new Error(`GET failed: ${r.status} ${await r.text()}`);
    const batch = await r.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

async function totalCount() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id&limit=0`, {
    headers: { ...headers, Prefer: "count=exact" },
  });
  const range = r.headers.get("content-range") ?? "*/0";
  return parseInt(range.split("/")[1] ?? "0", 10);
}

async function singlePhotoCount() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id&image_count=lte.1&limit=0`, {
    headers: { ...headers, Prefer: "count=exact" },
  });
  const range = r.headers.get("content-range") ?? "*/0";
  return parseInt(range.split("/")[1] ?? "0", 10);
}

async function deleteBatch(ids) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=in.(${ids.join(",")})`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=minimal" },
  });
  if (!r.ok) throw new Error(`DELETE failed (${ids.length} ids): ${r.status} ${await r.text()}`);
}

const beforeTotal = await totalCount();
const beforeSingle = await singlePhotoCount();
console.log(`Before: total=${beforeTotal}, image_count<=1=${beforeSingle}`);

const rows = await fetchAllIds();
if (rows.length !== beforeSingle) {
  console.warn(
    `⚠️  Fetched ${rows.length} single-photo rows but count said ${beforeSingle}; continuing with fetched ids.`,
  );
}

// Backup before any mutation.
const backup = {
  generatedAt: new Date().toISOString(),
  filter: "image_count <= 1",
  count: rows.length,
  ids: rows.map((r) => r.id),
  properties: rows,
};
fs.writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));
console.log(`Backup saved: ${BACKUP_PATH} (${rows.length} rows)`);

if (dryRun) {
  console.log("Dry run — nothing deleted.");
  process.exit(0);
}

let deleted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  await deleteBatch(batch.map((r) => r.id));
  deleted += batch.length;
  console.log(`Deleted ${deleted}/${rows.length}`);
}

const afterTotal = await totalCount();
const afterSingle = await singlePhotoCount();
console.log(`After: total=${afterTotal}, image_count<=1=${afterSingle}`);
console.log(
  afterSingle === 0 ? "✅ No single-photo properties remain." : `⚠️  ${afterSingle} single-photo rows remain.`,
);
