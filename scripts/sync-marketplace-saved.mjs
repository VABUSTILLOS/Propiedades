#!/usr/bin/env node
/**
 * sync-marketplace-saved.mjs — sync Victor's saved Facebook Marketplace
 * listings into `marketplace_saved_listings` (migration 052), the table
 * behind /admin/guardados.
 *
 * The extraction itself (facebook-cli `marketplace saved` + `listing
 * details`, gallery walk in the logged-in browser, photo upload to the
 * `property-images` bucket) happens outside the portal; this script only
 * loads the resulting JSON. Photo fields must therefore already be
 * Supabase Storage URLs — Facebook CDN URLs are signed and expire.
 *
 * Input: a JSON file with an array of objects shaped like the table:
 *
 *   [
 *     {
 *       "listing_id": "1419419379558591",
 *       "title": "5 habitaciones 2.5 baños Casa",
 *       "price": 2650000,
 *       "currency": "MXN",
 *       "location": "Chihuahua, Chih",
 *       "colonia": "Cafetales",
 *       "city": "Chihuahua",
 *       "category": "propiedad",          // propiedad | auto | tecnologia | otro
 *       "is_property": true,
 *       "condition": "Usado",
 *       "listing_status": "Available",    // Available | Sold | Rented
 *       "description": "Descripción completa del anuncio…",
 *       "bedrooms": 5,
 *       "bathrooms": 2.5,
 *       "area_m2": 217,
 *       "source_url": "https://www.facebook.com/marketplace/item/1419419379558591",
 *       "primary_photo_url": "https://<project>.supabase.co/storage/v1/object/public/property-images/<uuid>/0.jpg",
 *       "photo_urls": ["https://…/0.jpg", "https://…/1.jpg"],
 *       "saved_order": 0,
 *       "listing_created_at": "2026-02-02T20:45:01.000Z"
 *     }
 *   ]
 *
 * Idempotency: upsert on listing_id. For rows that already exist, the
 * workflow fields (status, imported_property_id) are NOT sent, so a
 * re-sync refreshes the ad data without resurrecting discarded listings
 * or un-marking imported ones. New rows are inserted with status
 * 'active' unless the JSON provides one.
 *
 * Usage:
 *   node scripts/sync-marketplace-saved.mjs <file.json> [--dry-run]
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
const fileArg = args.find((a) => a.endsWith(".json"));
const dryRun = args.includes("--dry-run");

if (!fileArg) {
  console.error("Usage: node scripts/sync-marketplace-saved.mjs <file.json> [--dry-run]");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const CATEGORIES = new Set(["propiedad", "auto", "tecnologia", "otro"]);
const LISTING_STATUSES = new Set(["Available", "Sold", "Rented"]);
const WORKFLOW_STATUSES = new Set(["active", "discarded", "imported"]);

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */

function toNumberOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v) {
  const n = toNumberOrNull(v);
  return n === null ? null : Math.trunc(n);
}

function toStringOrNull(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function toIsoOrNull(v) {
  const s = toStringOrNull(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Normalize one raw JSON item into table fields (minus workflow state). */
function normalizeItem(raw, index) {
  const listingId = raw?.listing_id != null ? String(raw.listing_id).trim() : "";
  if (!listingId) {
    console.warn(`  [skip] item ${index}: missing listing_id`);
    return null;
  }

  const category = CATEGORIES.has(raw.category) ? raw.category : "otro";
  const photoUrls = Array.isArray(raw.photo_urls)
    ? raw.photo_urls.filter((u) => typeof u === "string" && /^https?:\/\//.test(u))
    : [];

  return {
    listing_id: listingId,
    title: toStringOrNull(raw.title) ?? "Publicación de Marketplace",
    price: toNumberOrNull(raw.price),
    currency:
      typeof raw.currency === "string" && /^[A-Za-z]{3}$/.test(raw.currency.trim())
        ? raw.currency.trim().toUpperCase()
        : "MXN",
    location: toStringOrNull(raw.location),
    colonia: toStringOrNull(raw.colonia),
    city: toStringOrNull(raw.city),
    category,
    is_property:
      typeof raw.is_property === "boolean" ? raw.is_property : category === "propiedad",
    condition: toStringOrNull(raw.condition),
    listing_status: LISTING_STATUSES.has(raw.listing_status) ? raw.listing_status : null,
    description: typeof raw.description === "string" ? raw.description : null,
    bedrooms: toNumberOrNull(raw.bedrooms),
    bathrooms: toNumberOrNull(raw.bathrooms),
    area_m2: toNumberOrNull(raw.area_m2),
    source_url:
      toStringOrNull(raw.source_url) ??
      `https://www.facebook.com/marketplace/item/${listingId}`,
    primary_photo_url: toStringOrNull(raw.primary_photo_url) ?? photoUrls[0] ?? null,
    photo_urls: photoUrls,
    saved_order: toIntOrNull(raw.saved_order),
    listing_created_at: toIsoOrNull(raw.listing_created_at),
    // Only used when the row is new; stripped before updating existing rows.
    status: WORKFLOW_STATUSES.has(raw.status) ? raw.status : "active",
  };
}

/* ------------------------------------------------------------------ *
 *  PostgREST calls
 * ------------------------------------------------------------------ */

async function fetchExistingListingIds() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/marketplace_saved_listings?select=listing_id&limit=10000`,
    { headers },
  );
  if (!res.ok) {
    throw new Error(`GET marketplace_saved_listings failed: ${res.status} ${await res.text()}`);
  }
  const rows = await res.json();
  return new Set(rows.map((r) => r.listing_id));
}

async function upsertBatch(rows) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/marketplace_saved_listings?on_conflict=listing_id`,
    {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    throw new Error(`POST upsert failed: ${res.status} ${await res.text()}`);
  }
}

/* ------------------------------------------------------------------ *
 *  Main
 * ------------------------------------------------------------------ */

const rawItems = JSON.parse(fs.readFileSync(fileArg, "utf8"));
if (!Array.isArray(rawItems)) {
  console.error("The input file must contain a JSON array of listings.");
  process.exit(1);
}

const items = rawItems.map(normalizeItem).filter(Boolean);
console.log(`Read ${rawItems.length} items, ${items.length} valid.`);

const existing = dryRun ? new Set() : await fetchExistingListingIds();
const now = new Date().toISOString();

const newRows = [];
const existingRows = [];
for (const item of items) {
  if (existing.has(item.listing_id)) {
    // Never touch workflow state on re-sync (see header).
    const { status, ...data } = item;
    void status;
    existingRows.push({ ...data, synced_at: now, updated_at: now });
  } else {
    newRows.push({ ...item, synced_at: now, updated_at: now });
  }
}

console.log(`New: ${newRows.length} · Existing (data refresh only): ${existingRows.length}`);

if (dryRun) {
  console.log("[dry-run] No writes performed.");
  process.exit(0);
}

const CHUNK = 200;
for (let i = 0; i < newRows.length; i += CHUNK) {
  await upsertBatch(newRows.slice(i, i + CHUNK));
}
for (let i = 0; i < existingRows.length; i += CHUNK) {
  await upsertBatch(existingRows.slice(i, i + CHUNK));
}

console.log("Sync complete.");
