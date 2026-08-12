#!/usr/bin/env node
/**
 * import-vivanuncios.mjs — mass import of Vivanuncios listings into `properties`.
 *
 * Reads a JSON-lines file (default `.scrape/backfill-output.jsonl`) produced by
 * the Vivanuncios spiders and inserts each listing as an active property row —
 * no LLM, no geocoding, no per-page crawling. The catalog already ships 105
 * Chihuahua rows imported this way; run again after a fresh crawl to bring in
 * other cities / deals.
 *
 *   JSONL field → properties column
 *   --------------------------------
 *   listing_id_vivanuncios → listing_id_vivanuncios (idempotency key)
 *   title                  → title + slug (transliterated, unique)
 *   url                    → source_url
 *   price "MN 14,990,000"  → price 14990000, currency "MXN"
 *   location               → colonia / city / state (split by comma)
 *   floor_size_m2          → construccion_m2 (and terreno_m2)
 *   number_of_bedrooms     → recamaras
 *   images / property_image→ images (array)
 *   agency_name            → contact_name, contact_type "agency"
 *   contact_phone          → contact_phone + contact_whatsapp
 *   contact_methods_available → contact_methods_available
 *   type                   → type (from URL: "renta-" → "rent", default "sale")
 *   title                  → category (keyword heuristic)
 *   days_published         → created_at (newest listings surface first)
 *
 * Idempotent: rows whose `listing_id_vivanuncios` (or `source_url`) already
 * exist are skipped, so re-runs after a crawl don't duplicate.
 *
 * Usage:
 *   node scripts/import-vivanuncios.mjs [file.jsonl] [--dry-run] [--limit N]
 *       [--type sale|rent] [--city "Chihuahua"] [--state "Chihuahua"]
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
const typeArg = args.find((a) => a.startsWith("--type="))?.split("=")[1];
const FILE = fileArg ?? ".scrape/backfill-output.jsonl";
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg, 10)) : null;
// Fallbacks for listings whose location is empty/ambiguous. The current spider
// crawls Chihuahua sales; pass --city / --state when running other cities.
const DEFAULT_CITY = args.find((a) => a.startsWith("--city="))?.split("=")[1] ?? "";
const DEFAULT_STATE = args.find((a) => a.startsWith("--state="))?.split("=")[1] ?? "";

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

/** Parse "MN 14,990,000" → 14990000 (numeric), or null. */
function parsePrice(raw) {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace(/[^\d.]/g, "").replace(/,/g, "");
  if (!cleaned || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "MN 14,990,000" → "MXN"; "USD 350,000" → "USD"; null → "MXN" (default). */
function priceCurrency(raw) {
  if (typeof raw === "string" && /^USD\b/i.test(raw.trim())) return "USD";
  return "MXN";
}

function toPosIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number.parseInt(String(v).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "Publicado hace 207 días" → 207; "hoy" → 0; unknown → null. */
function daysFromPublished(raw) {
  if (!raw) return null;
  const label = String(raw).toLowerCase();
  if (label.includes("hoy")) return 0;
  if (label.includes("ayer")) return 1;
  const m = label.match(/hace\s+(\d+)\s+d[ií]as?/);
  if (m) return parseInt(m[1], 10);
  const h = label.match(/hace\s+(\d+)\s+horas?/);
  if (h) return Math.max(0, Math.round(parseInt(h[1], 10) / 24));
  return null;
}

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

/** Classify category from title/URL (keyword heuristic). */
function classifyCategory(title, url) {
  const haystack = `${title} ${url ?? ""}`.toLowerCase();
  if (/\b(terreno|predio|lote|solar|parcela)\b/.test(haystack)) return "terreno";
  if (/\b(bodega|nave)\b/.test(haystack)) return "bodega";
  if (/\b(local|oficina)\b/.test(haystack)) return "local";
  if (/\b(depto|departamento)\b/.test(haystack)) return "departamento";
  return "casa";
}

/** Infer deal type (sale/rent) from the listing URL path. */
function inferType(url, forced) {
  if (forced) return forced;
  const u = (url ?? "").toLowerCase();
  if (u.includes("renta-") || u.includes("/r-")) return "rent";
  return "sale";
}

/** Split "Colonia,  Fracc, Ciudad, Chihuahua" → {colonia, city, state}. */
function parseLocation(location) {
  const parts = (location ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const KNOWN_STATES = new Set([
    "aguascalientes", "baja california", "baja california sur", "campeche",
    "chiapas", "chihuahua", "coahuila", "colima", "durango", "guanajuato",
    "guerrero", "hidalgo", "jalisco", "méxico", "michoacán", "morelos",
    "nayarit", "nuevo león", "oaxaca", "puebla", "querétaro", "quintana roo",
    "san luis potosí", "sinaloa", "sonora", "tabasco", "tamaulipas",
    "tlaxcala", "veracruz", "yucatán", "zacatecas", "cdmx", "ciudad de méxico",
  ]);
  const STATE_ABBR = { "chih.": "chihuahua" };

  const colonia = parts[0] ?? "";
  // Vivanuncios format: address/colonia, neighborhood, CITY — the city is
  // always the last token. When that token is also a known state name
  // (e.g. Chihuahua, Colima, Oaxaca), reuse it as the state.
  const lastRaw = parts[parts.length - 1] ?? "";
  const lastKey = lastRaw.toLowerCase().replace(/\.+$/, "");
  const lastNorm = STATE_ABBR[lastKey] ?? lastRaw;
  const city = lastNorm;
  const state = KNOWN_STATES.has(lastKey) ? lastNorm : "";

  return { colonia, city, state };
}

/** Fallback city/state from the listing URL when location is empty/ambiguous. */
function cityFromUrl(url) {
  const KNOWN = [
    "chihuahua", "ciudad juárez", "juárez", "monterrey", "guadalajara",
    "ciudad de méxico", "cdmx", "puebla", "querétaro", "tijuana",
    "mexicali", "mérida", "veracruz", "torreón", "cancún", "morelia",
    "oaxaca", "zacatecas", "durango", "colima", "cuauhtémoc", "jiménez",
  ];
  const u = (url ?? "").toLowerCase();
  for (const c of KNOWN) {
    if (u.includes(`-${c.replace(/\s/g, "-")}`) || u.includes(`/${c}`)) {
      const title = c === "cdmx" ? "CDMX" : c.replace(/\b\w/g, (m) => m.toUpperCase());
      return { city: title, state: c === "chihuahua" ? "Chihuahua" : "" };
    }
  }
  return { city: "", state: "" };
}

/** Derive created_at from published days ago so newest listings show first. */
function createdFromPublished(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/* ------------------------------------------------------------------ *
 *  Idempotency checks
 * ------------------------------------------------------------------ */

async function existsByListingId(listingId) {
  if (!listingId) return false;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id&listing_id_vivanuncios=eq.${encodeURIComponent(listingId)}`, {
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

async function buildUniqueSlug(title) {
  const base = slugify(title) || "propiedad-vivanuncios";
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
  const lines = fs
    .readFileSync(FILE, "utf8")
    .split("\n")
    .filter(Boolean);
  console.log(`Reading ${lines.length} listings from ${FILE}${LIMIT ? ` (limit ${LIMIT})` : ""}`);

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

    const listingId = String(it.listing_id_vivanuncios ?? it.url?.match(/(\d+)\/?$/)?.[1] ?? "");

    // Idempotency: skip already-imported listings.
    if (listingId && (await existsByListingId(listingId))) {
      console.log(`  [${i}] skip (ya existe): ${listingId}`);
      skipped++;
      continue;
    }
    if (it.url && (await existsBySourceUrl(it.url))) {
      console.log(`  [${i}] skip (url ya existe): ${it.url}`);
      skipped++;
      continue;
    }

    const title = it.title?.trim() || `Propiedad Vivanuncios ${listingId}`;
    const slug = await buildUniqueSlug(title);
    const price = parsePrice(it.price);
    const type = inferType(it.url, typeArg);
    const { colonia, city, state } = parseLocation(it.location);
    const urlCity = cityFromUrl(it.url);
    const resolvedCity = city || urlCity.city || DEFAULT_CITY || state || urlCity.state;
    const resolvedState = state || urlCity.state || DEFAULT_STATE || resolvedCity;    const construccion_m2 = toPosIntOrNull(it.floor_size_m2);
    const recamaras = toPosIntOrNull(it.number_of_bedrooms);    const daysAgo = daysFromPublished(it.days_published);
    const images = Array.isArray(it.images) && it.images.length
      ? it.images
      : it.property_image
        ? [it.property_image]
        : [];

    const row = {
      owner_id: OWNER_ID,
      title,
      slug,
      description: title, // listing tiles carry the full description already
      type,
      category: classifyCategory(title, it.url),
      status: "active",
      current_wizard_step: 4,
      price,
      currency: priceCurrency(it.price),
      construccion_m2: construccion_m2 ?? 0,
      terreno_m2: construccion_m2 ?? 0,
      recamaras,
      colonia,
      city: resolvedCity,
      state: resolvedState,
      images,
      source_url: it.url ?? null,
      listing_id_vivanuncios: listingId || null,
      source_name: "vivanuncios",
      contact_name: it.agency_name ?? null,
      contact_type: it.agency_name ? "inmobiliaria" : null,
      contact_phone: it.contact_phone ?? null,
      contact_whatsapp: it.contact_phone ?? null,
      contact_methods_available: Array.isArray(it.contact_methods_available)
        ? it.contact_methods_available
        : null,
      created_at: daysAgo !== null ? createdFromPublished(daysAgo) : undefined,
      updated_at: new Date().toISOString(),
    };

    if (dryRun) {
      console.log(`  [${i}] [dry-run] insertaría: ${title} — $${price} — ${city || "?"}`);
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
    console.log(`  [${i}] ✓ insertado — ${title} — $${price} — ${city || "?"}`);
  }

  console.log(`\nInsertados: ${inserted} · Omitidos: ${skipped} · Errores: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
