#!/usr/bin/env node
/**
 * import-propiedades.mjs — mass import of Propiedades.com listings into `properties`.
 *
 * Reads a JSON-lines file (default `.scrape/propiedades-com/dataset-21.jsonl`)
 * produced from the Wayback-captured Propiedades.com list pages (Chihuahua,
 * venta, ≤ 3,000,000 MXN) and inserts each listing as an active property row.
 *
 *   JSONL field → properties column
 *   ---------------------------------
 *   listing_id_propiedades → listing_id_propiedades + source_url (idempotency keys)
 *   title                  → title + slug (transliterated, unique)
 *   url                    → source_url
 *   price                  → price, currency (MXN)
 *   bedrooms / bathrooms   → recamaras / banos
 *   land_area_m2           → terreno_m2
 *   street_address         → address
 *   neighborhood           → colonia
 *   city / state / postal_code → city / state / zip_code
 *   latitude / longitude   → lat / lng
 *   images                 → images + image_sources (original cdn.propiedades.com URLs)
 *   description            → description
 *   property_type          → category (keyword heuristic)
 *   operation_type         → type ("Venta" → "sale")
 *   date_posted            → created_at
 *   is_featured            → is_top
 *   source_name            → "propiedades"
 *
 * Dedup (user requirement — photo + price): before inserting, each listing is
 * compared against existing rows. A listing is SKIPPED if:
 *   1. its listing_id_propiedades or source_url already exists (re-run idempotency), or
 *   2. ANY of its image URLs normalizes to an image already stored in another
 *      row's image_sources AND the price matches exactly (photo + price match).
 * Plus a price + colonia heuristic fallback (matches across portals when the
 * photo CDN domains differ).
 *
 * Usage:
 *   node scripts/import-propiedades.mjs [file.jsonl] [--dry-run] [--limit N]
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
const fileArg = args.find((a) => /\.(jl|jsonl)$/.test(a));
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const FILE = fileArg ?? ".scrape/propiedades-com/dataset-21.jsonl";
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg, 10)) : null;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const OWNER_ID = "80a2428b-4d50-435d-8ce1-b1a9eba61176"; // demo agent (seed 007)

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */

const TRANSLITERATION = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u",
  ü: "u", ñ: "n", Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U", Ñ: "N",
};

function slugify(input) {
  return input
    .split("")
    .map((c) => TRANSLITERATION[c] ?? c)
    .join("")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Classify category from property_type / title (keyword heuristic). */
function classifyCategory(propertyType, title) {
  const haystack = `${propertyType ?? ""} ${title ?? ""}`.toLowerCase();
  if (/\b(terreno|predio|lote|solar|parcela|habitacional)\b/.test(haystack)) return "terreno";
  if (/\b(bodega|nave)\b/.test(haystack)) return "bodega";
  if (/\b(local|oficina)\b/.test(haystack)) return "local";
  if (/\b(depto|departamento)\b/.test(haystack)) return "departamento";
  return "casa";
}

/** "Venta" → "sale"; anything else → null (default "sale"). */
function inferType(operationType) {
  const op = String(operationType ?? "").toLowerCase();
  if (op.includes("renta") || op.includes("arriendo")) return "rent";
  return "sale";
}

function toPosIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number.parseInt(String(v).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Strip CDN size dirs (336x200, 600x400, 1200x507) + placeholders to a filename key. */
function normalizeImageUrl(u) {
  if (!u) return null;
  let s = String(u);
  // drop placeholder art
  if (/background-card|placeholder|sin-imagen|no-disponible/i.test(s)) return null;
  s = s.replace(/\/files\/\d+x\d+\//, "/files/").replace(/\/card\/.*/, "");
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  return s.trim();
}

/** " , Col. Ciudad Universitaria" → "Ciudad Universitaria"; strips junk prefixes. */
function cleanColonia(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/^(.*col\.?\s+)/i, "") // keep text after "Col."
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normText(s) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(col|colonia|fracc|fraccionamiento|cdp?\.?|numero|#)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ *
 *  Idempotency + dedup checks
 * ------------------------------------------------------------------ */

/** All existing rows' id, price, currency, colonia, address, image_sources — loaded once. */
async function loadExisting() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/properties?select=id,title,price,currency,colonia,address,image_sources,source_url&limit=1000`,
    { headers },
  );
  if (!r.ok) throw new Error(`GET existing failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function existsByListingId(listingId) {
  if (!listingId) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id&listing_id_propiedades=eq.${encodeURIComponent(listingId)}`, {
    headers,
  });
  if (!r.ok) throw new Error(`GET by listing_id failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return data.length > 0;
}

async function existsBySourceUrl(sourceUrl) {
  if (!sourceUrl) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id&source_url=eq.${encodeURIComponent(sourceUrl)}`, {
    headers,
  });
  if (!r.ok) throw new Error(`GET by source_url failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return data.length > 0;
}

/**
 * Photo + price dedup. Returns the matched existing row, or null.
 * - Builds an image-key → rows index once from existing rows' image_sources.
 * - A new listing matches if any of its images normalizes to a key owned by a
 *   row with the SAME price + currency (photo + price match, per user request).
 * - Fallback: same price + overlapping colonia/address text (cross-portal match).
 */
function findDuplicate(newListing, existingRows, imageIndex) {
  const price = newListing.price;
  const newImgs = (newListing.images ?? []).map(normalizeImageUrl).filter(Boolean);
  const photoMatches = new Set();
  for (const key of newImgs) {
    for (const row of imageIndex.get(key) ?? []) photoMatches.add(row.id);
  }
  for (const row of existingRows) {
    if (!photoMatches.has(row.id)) continue;
    if (row.price === price && row.currency === (newListing.price_currency ?? "MXN")) {
      return { type: "photo+price", row };
    }
  }
  // price + colonia/address heuristic fallback (CDN domains differ across portals)
  const nn = normText(newListing.neighborhood || newListing.street_address || "");
  if (nn) {
    for (const row of existingRows) {
      if (row.price !== price || row.currency !== (newListing.price_currency ?? "MXN")) continue;
      const en = normText(row.colonia || row.address || "");
      if (en && (en.includes(nn) || nn.includes(en))) return { type: "price+colonia", row };
    }
  }
  return null;
}

async function buildUniqueSlug(title) {
  const base = slugify(title) || "propiedad-propiedades";
  let candidate = base;
  for (let attempt = 0; attempt < 12; attempt++) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id&slug=eq.${encodeURIComponent(candidate)}`, {
      headers,
    });
    if (!r.ok) throw new Error(`GET slug failed: ${r.status} ${await r.text()}`);
    const data = await r.json();
    if (data.length === 0) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ *
 *  Main
 * ------------------------------------------------------------------ */

async function main() {
  if (!fs.existsSync(FILE)) {
    console.error(`File not found: ${FILE}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean);
  console.log(`Reading ${lines.length} listings from ${FILE}${LIMIT ? ` (limit ${LIMIT})` : ""}`);

  console.log("Loading existing rows for dedup…");
  const existingRows = await loadExisting();
  const imageIndex = new Map();
  for (const row of existingRows) {
    for (const u of row.image_sources ?? []) {
      const key = normalizeImageUrl(u);
      if (!key) continue;
      if (!imageIndex.has(key)) imageIndex.set(key, []);
      imageIndex.get(key).push(row);
    }
  }
  console.log(`  ${existingRows.length} existing rows, ${imageIndex.size} unique image keys`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const [i, line] of lines.entries()) {
    if (LIMIT && inserted + skipped >= LIMIT) break;
    let it;
    try {
      it = JSON.parse(line);
    } catch {
      console.error(`  [${i}] skip: invalid JSON line`);
      errors++;
      continue;
    }

    const listingId = String(it.listing_id_propiedades ?? it.url?.match(/(\d+)\/?$/)?.[1] ?? "");
    if (!listingId) {
      console.error(`  [${i}] skip: no listing id`);
      errors++;
      continue;
    }

    // Idempotency: same listing id or source URL already imported (re-run protection).
    if ((await existsByListingId(listingId)) || (it.url && (await existsBySourceUrl(it.url)))) {
      console.log(`  [${i}] skip (ya existe): ${listingId}`);
      skipped++;
      continue;
    }

    // User dedup requirement: photo + price match against existing rows.
    const dup = findDuplicate(it, existingRows, imageIndex);
    if (dup) {
      console.log(`  [${i}] skip (${dup.type} match): ${listingId} → ${dup.row.title?.slice(0, 50)}`);
      skipped++;
      continue;
    }

    const title = it.title?.trim() || `Propiedad ${listingId}`;
    const slug = await buildUniqueSlug(title);
    const price = it.price;
    const currency = it.price_currency === "USD" ? "USD" : "MXN";
    const type = inferType(it.operation_type);
    const category = classifyCategory(it.property_type, it.title);
    const recamaras = toPosIntOrNull(it.bedrooms);
    const banos = toPosIntOrNull(it.bathrooms);
    const terreno_m2 = toPosIntOrNull(it.land_area_m2);
    const images = Array.isArray(it.images) ? it.images.filter(Boolean) : [];
    const colonia = cleanColonia(it.neighborhood || it.street_address || "");
    const description = it.description?.trim() || title;

    const row = {
      owner_id: OWNER_ID,
      title,
      slug,
      description,
      type,
      category,
      status: "active",
      current_wizard_step: 4,
      price,
      currency,
      recamaras,
      banos,
      terreno_m2: terreno_m2 ?? 0,
      // NOT NULL columns carry DB defaults — use them instead of null.
      address: it.street_address || "",
      colonia: colonia || "",
      city: it.city || "",
      state: it.state || "",
      zip_code: it.postal_code ?? null,
      lat: it.latitude ?? 0,
      lng: it.longitude ?? 0,
      images,
      image_sources: images,
      source_url: it.url ?? null,
      listing_id_propiedades: listingId || null,
      source_name: "propiedades",
      is_top: Boolean(it.is_featured),
      created_at: it.date_posted ? new Date(it.date_posted).toISOString() : undefined,
      updated_at: new Date().toISOString(),
    };

    if (dryRun) {
      console.log(`  [${i}] [dry-run] insertaría: ${title.slice(0, 60)} — $${price} — ${colonia || "?"}`);
      inserted++;
      continue;
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      console.error(`  [${i}] ERROR insertando ${title}: ${r.status} ${await r.text()}`);
      errors++;
      continue;
    }
    inserted++;
    console.log(`  [${i}] ✓ insertado — ${title.slice(0, 60)} — $${price} — ${colonia || "?"}`);
  }

  console.log(`\nInsertados: ${inserted} · Omitidos: ${skipped} · Errores: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
