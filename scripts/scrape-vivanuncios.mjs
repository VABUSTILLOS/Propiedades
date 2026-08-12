#!/usr/bin/env node
/**
 * Scrape propiedades en venta de Chihuahua (Vivanuncios), ordenadas por las
 * más recientemente publicadas, e insertarlas en Supabase (properties).
 *
 * Uses the Jina AI Reader to bypass Cloudflare, DeepSeek to extract structured
 * data from detail pages, Google Maps Geocoding for coordinates, and the
 * Supabase REST API (service role) for inserts.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JINA_API_KEY,
 *      DEEPSEEK_API_KEY (or KIEAI_API_KEY), GOOGLE_MAPS_SERVER_KEY.
 *
 * Usage:
 *   node scripts/scrape-vivanuncios.mjs [--pages 3] [--limit 60] [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";

// Node >=20.12 loads .env.local without a dotenv dependency.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local — fall back to ambient env vars.
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const JINA_API_KEY = process.env.JINA_API_KEY ?? "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
const KIEAI_API_KEY = process.env.KIEAI_API_KEY ?? "";
const KIEAI_MODEL = process.env.KIEAI_MODEL ?? "gemini-2.5-flash";
const GOOGLE_MAPS_KEY =
  process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// Demo agent that owns imported listings (bypasses RLS via service role).
const OWNER_ID = "80a2428b-4d50-435d-8ce1-b1a9eba61176";

// Base search URLs. Vivanuncios ignores pagination when `sort=more_recent` is
// present (p2/p3 return page 1), so page 1 keeps the sort and pages 2+ drop it.
const SEARCH_URL_TEMPLATE =
  "https://www.vivanuncios.com.mx/s-venta-inmuebles/chihuahua/v1c1097l1005p{PAGE}?sort=most_lowered_price";
const SEARCH_URL_TEMPLATE_NO_SORT =
  "https://www.vivanuncios.com.mx/s-venta-inmuebles/chihuahua/v1c1097l1005p{PAGE}";

// Remate bancario filter URLs (same pagination behavior: sort on page 1 only).
const REMATES_URL_TEMPLATE =
  "https://www.vivanuncios.com.mx/s-venta-inmuebles/chihuahua/remate-bancario/v1c1097l1005q0p{PAGE}?sort=most_lowered_price";
const REMATES_URL_TEMPLATE_NO_SORT =
  "https://www.vivanuncios.com.mx/s-venta-inmuebles/chihuahua/remate-bancario/v1c1097l1005q0p{PAGE}";

// CLI args
const args = process.argv.slice(2);
const pageCount = parseArg(args, "--pages", 3);
const maxListings = parseArg(args, "--limit", 60);
const dryRun = args.includes("--dry-run");
const rematesMode = args.includes("--remates");
const skipDetail = args.includes("--skip-detail");

function parseArg(args, name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) || fallback : fallback;
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !JINA_API_KEY) {
  console.error(
    "Missing env: set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and JINA_API_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isCloudflareBlocked(text) {
  if (!text || text.length < 2000) return true;
  // Genuine challenge pages only. Real Vivanuncios pages legitimately embed
  // a /cdn-cgi/challenge-platform script — do NOT treat that as a block.
  return (
    /<title>\s*Just a moment/.test(text) ||
    text.includes("Just a moment...") ||
    text.includes("Performing security verification")
  );
}

/**
 * Fetch a page through the Jina Reader with retries/backoff.
 * `format` controls Jina output: "html" (raw-ish DOM, best for search pages)
 * or "markdown" (readable text, best for detail pages).
 */
async function jinaFetch(targetUrl, { format = "html", retries = 4, waitSelector } = {}) {
  const jinaUrl = `https://r.jina.ai/${targetUrl}`;
  // NOTE: X-No-Cache: true causes Cloudflare challenges on some pages — omit it.
  const baseHeaders = {
    Authorization: `Bearer ${JINA_API_KEY}`,
    "X-Timeout": "60",
  };
  if (format === "html") baseHeaders["X-Return-Format"] = "html";
  if (waitSelector) baseHeaders["X-Wait-For-Selector"] = waitSelector;

  // NOTE: do NOT use `cache: "no-store"` on the fetch — it forces Jina to
  // re-render live and the origin (vivanuncios) Cloudflare-challenges those
  // fetches. Letting Jina serve its cached copy is what actually gets through.

  let lastErr = null;
  // Attempts with the API key first; if the account runs out of balance
  // (402 InsufficientBalanceError), retry the same URL anonymously so Jina's
  // shared cache can still serve it when a copy exists. The anonymous attempt
  // must keep the format/selector headers, otherwise Jina returns markdown.
  const anonHeaders = { ...baseHeaders };
  delete anonHeaders.Authorization;
  for (const headers of [baseHeaders, anonHeaders]) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(jinaUrl, { headers });
        const text = await res.text();
        if (!res.ok || res.status === 402 || text.includes("InsufficientBalance")) {
          lastErr = new Error(`Jina HTTP ${res.status || "402"}`);
          // If the key is out of balance, don't burn retries on it — fall
          // through to the anonymous attempt immediately.
          if (headers.Authorization && (res.status === 402 || text.includes("InsufficientBalance"))) {
            break;
          }
          await sleep(2000 * attempt);
          continue;
        }
        if (isCloudflareBlocked(text)) {
          lastErr = new Error("Cloudflare challenge returned");
          await sleep(3000 * attempt);
          continue;
        }
        return text;
      } catch (err) {
        lastErr = err;
        await sleep(3000 * attempt);
      }
    }
  }
  throw lastErr ?? new Error("Jina fetch failed");
}

/* ------------------------------------------------------------------ *
 *  Search page parsing (HTML format)
 * ------------------------------------------------------------------ */

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

/**
 * Normalize a MX phone found in listing text to a whitespace-free 10-digit
 * string (e.g. "614 2 52 38 83" → "6142523883"). Returns null when absent.
 */
function extractMxPhone(text) {
  if (!text) return null;
  const m = text.match(/\d{3}\s+\d\s+\d{2}\s+\d{2}\s+\d{2}/);
  if (!m) return null;
  return m[0].replace(/\s+/g, "");
}

function parseSearchPage(html) {
  const cards = html.split('data-qa="posting PROPERTY"').slice(1);
  const listings = [];

  for (const card of cards) {
    const idMatch = card.match(/data-id="(\d+)"/);
    const urlMatch = card.match(/data-to-posting="([^"]+)"/);
    if (!idMatch || !urlMatch) continue;

    const listingUrl = urlMatch[1].replace(/&amp;/g, "&");
    const cleanUrl = listingUrl.split("?")[0];
    if (!/\/a-/.test(cleanUrl)) continue;

    // Agency name from the publisher logo URL, e.g.
    // img10.naventcdn.com/empresas/.../130x70/logo_kasar-bienes-raices_1768680150720.jpg
    const publisherImg = card.match(/data-qa="POSTING_CARD_PUBLISHER"[^>]*src="([^"]+)"/);
    const logoSlug = publisherImg?.[1].match(/logo_([a-z0-9-]+)_\d+\.jpg/)?.[1] ?? null;
    const contactName = logoSlug ? AGENCY_NAMES[logoSlug] ?? logoSlug.replace(/-/g, " ") : null;

    // Visible text tokens (price, m², rec/baños, address, description)
    const visible = card
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "|")
      .replace(/&amp;/gi, "&")
      .replace(/&nbsp;/gi, " ")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"');
    const tokens = visible
      .split("|")
      .map((t) => t.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const priceMatch = tokens.find((t) => /^MN\s*\$?[\d,]+/.test(t)) || "";
    const price = parseInt(priceMatch.replace(/[^\d]/g, ""), 10) || 0;

    const m2Match = tokens.find((t) => /(\d+[\d,.]*)\s*m²?\s*(lote|const|m2)/i.test(t));
    const m2Raw = m2Match ? m2Match.match(/(\d+[\d,.]*)/)?.[1] : "0";
    const terreno_m2 = parseFloat(m2Raw.replace(/,/g, "")) || 0;

    const recMatch = tokens.find((t) => /(\d+)\s*rec\.?/i.test(t));
    const recamaras = recMatch ? parseInt(recMatch.match(/(\d+)/)[1], 10) : 0;

    const banosMatch = tokens.find((t) => /(\d+)\s*baños?/i.test(t));
    const banos = banosMatch ? parseInt(banosMatch.match(/(\d+)/)[1], 10) : 0;

    const estacMatch = tokens.find((t) => /(\d+)\s*estac\.?/i.test(t));
    const estacionamientos = estacMatch ? parseInt(estacMatch.match(/(\d+)/)[1], 10) : 0;

    const antiguedadMatch = tokens.find((t) => /(\d+)\s*años?/i.test(t));
    const antiguedad = antiguedadMatch ? parseInt(antiguedadMatch.match(/(\d+)/)[1], 10) : 0;

    const pubMatch = card.match(/Publicado\s+(hoy|desde ayer|hace\s+\d+\s+(?:días?|horas?))/i);
    const publishedLabel = pubMatch ? pubMatch[0].replace(/^Publicado\s+/i, "").toLowerCase() : "";

    // Address tokens: after the m² line, before the duplicated price / description.
    const m2Idx = tokens.findIndex((t) => /(\d+)\s*m²/.test(t));
    const addressTokens = [];
    if (m2Idx >= 0) {
      for (let i = m2Idx + 1; i < tokens.length; i++) {
        const t = tokens[i];
        if (/^MN\s*\$?[\d,]/.test(t)) break;
        if (/^\d+\s*(rec\.?|baños?|estac\.?)/i.test(t)) continue;
        addressTokens.push(t);
      }
    }
    const address = addressTokens.filter((t) => t && t.length > 1).join(", ") || "";

    // All listing photos (skip logos via avisos path filter).
    const images = [
      ...card.matchAll(/<img[^>]+src="(https?:\/\/img10\.naventcdn\.com\/avisos[^"]+)"/g),
      ...card.matchAll(/data-flickity-lazyload="(https?:\/\/img10\.naventcdn\.com\/avisos[^"]+)"/g),
    ].map((m) => m[1]);
    const uniqueImages = [...new Set(images)].slice(0, 12);
    // Prefer the 720px variant if available (higher res) — keep original otherwise.
    const photos = uniqueImages.map((u) => u.replace(/(\d{3}x\d{3})\//, "720x480/"));

    // Title: first plausible gallery alt (some are og:image hashes).
    const alts = [...card.matchAll(/<img[^>]*\salt="([^"]*)"/g)].map((m) => m[1]);
    let title = "";
    for (const alt of alts) {
      const cleaned = alt.replace(/^[a-f0-9]{32,}\s*·\s*/i, "").replace(/^[a-f0-9]{32,}$/i, "");
      if (cleaned.length > 10 && /[a-záéíóúüñ]/i.test(cleaned) && !/^[a-f0-9]{32,}$/i.test(cleaned)) {
        title = cleaned;
        break;
      }
    }
    if (!title) {
      const titleToken = tokens.find((t) => t.length > 15 && /venta|casa|rec|m²/i.test(t));
      title = titleToken || cleanUrl.split("/").filter(Boolean).pop() || "Propiedad en Chihuahua";
    }

    // First image = gallery hero (isFirstImage marker), else first photo.
    let firstImage =
      photos.find((p) => p.includes("isFirstImage=true")) ||
      photos[0] ||
      "";

    // Short description: the longest text token after the address.
    const descStart = addressTokens.length
      ? tokens.indexOf(addressTokens[addressTokens.length - 1])
      : m2Idx;
    let description = "";
    if (descStart >= 0) {
      description = tokens
        .slice(descStart + 1)
        .find((t) => t.length > 60);
    }

    // Contact phone: only phones visible in plain text are extractable (tile
    // phone buttons are JS-masked behind "Ver datos"). Regex matches MX format
    // "614 2 52 38 83" found in the description or any card token.
    const contactPhone =
      extractMxPhone(description) || extractMxPhone(tokens.join(" ")) || null;

    listings.push({
      id: idMatch[1],
      url: `https://www.vivanuncios.com.mx${cleanUrl}`,
      sourceUrl: `https://www.vivanuncios.com.mx${cleanUrl}`,
      publishedLabel,
      publishedDays: labelToDays(publishedLabel),
      title,
      price,
      terreno_m2,
      construccion_m2: terreno_m2, // tile only exposes terreno; detail page refines it
      recamaras,
      banos,
      estacionamientos,
      antiguedad,
      address,
      description: description ?? "",
      images: photos,
      contactName,
      contactType: contactName ? "inmobiliaria" : null,
      contactPhone,
    });
  }
  return listings;
}

/** Convert "hoy"/"ayer"/"hace N días" → approximate days ago. */
function labelToDays(label) {
  if (!label) return 0;
  if (label === "hoy") return 0;
  if (label === "desde ayer") return 1;
  const m = label.match(/hace\s+(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/* ------------------------------------------------------------------ *
 *  Detail page extraction (DeepSeek / kie.ai fallback)
 * ------------------------------------------------------------------ */

async function chatCompletion({ system, user, jsonMode = false }) {
  const providerKey = DEEPSEEK_API_KEY || KIEAI_API_KEY;
  if (!providerKey) return null;
  const isDeepseek = Boolean(DEEPSEEK_API_KEY);
  const url = isDeepseek
    ? `${DEEPSEEK_BASE_URL}/chat/completions`
    : `https://api.kie.ai/${KIEAI_MODEL}/v1/chat/completions`;
  const model = isDeepseek ? DEEPSEEK_MODEL : KIEAI_MODEL;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${providerKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

const EXTRACT_SYSTEM =
  'You extract real-estate listing data from scraped web pages for the Mexican market. Respond ONLY with a JSON object, no markdown, no commentary. Schema:\n{"title": string (short listing title, Spanish), "price": number (integer MXN sale price, 0 if unknown), "currency": "MXN", "terreno_m2": number (land area m2, 0 if unknown), "construccion_m2": number (built area m2, 0 if unknown), "recamaras": number (bedrooms, 0 if unknown), "banos": number (bathrooms — count "medio baño" as 1, 0 if unknown), "estacionamientos": number (parking spaces, 0 if unknown), "antiguedad": number (property age in years, 0 if unknown), "description": string (2-4 sentence Spanish description), "address_text": string (street + number if present), "colonia": string, "city": string, "images": array of absolute https image URLs (max 20; ONLY actual photos of the property, typically from img10.naventcdn.com/avisos/ — never logos, icons or navigation images), "bento_highlights": array of 3-6 short Spanish highlight phrases (e.g. "A 5 min del metro", "Vista panorámica"), "category": one of "casa" | "departamento" | "local" | "bodega" | "terreno", "deal_type": one of "venta_directa" | "remate_bancario" | "flipping" | "traspaso". Classify from the title/description keywords: remate, adjudicación, banco → remate_bancario; traspaso, ceder → traspaso; reparar, remodelar, flipping → flipping; local/oficina → local; bodega/nave → bodega; terreno/lote → terreno. Default "venta_directa"/"casa". "institucion_bancaria": string or null (bank name for remates), "fecha_remate": string YYYY-MM-DD or null, "costo_reparacion_estimado": number MXN or null (flipping), "valor_post_reparacion_estimado": number MXN or null (flipping ARV), "condiciones_traspaso": string or null, "contact_name": string or null (agency/broker name, from footer "Publicado por" or publisher section), "contact_type": "inmobiliaria" | "agencia" | "particular" or null, "contact_phone": string or null (whitespace-free MX phone, e.g. "6142523883"; only if a real phone number is visible in the page text), "contact_email": string or null (only if an email is visible)}';

/** Convert a raw LLM value to a positive integer or null (0/undefined → null). */
function toPosIntOrNull(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Ask DeepSeek to extract structured data from a detail page markdown. */
async function extractFromDetail(markdown, fallbackTitle) {
  const content = await chatCompletion({
    jsonMode: true,
    system: EXTRACT_SYSTEM,
    user: `Extract the listing data from this page content:\n\n${markdown.slice(0, 18000)}`,
  });
  if (!content) return null;

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  try {
    const parsed = JSON.parse((fenced && fenced[1]) ?? content);
    if (typeof parsed !== "object" || parsed === null) return null;
    const category =
      ["casa", "departamento", "local", "bodega", "terreno"].includes(parsed.category)
        ? parsed.category
        : "casa";
    const dealType =
      ["venta_directa", "remate_bancario", "flipping", "traspaso"].includes(
        parsed.deal_type,
      )
        ? parsed.deal_type
        : "venta_directa";
    return {
      title: typeof parsed.title === "string" ? parsed.title : fallbackTitle,
      price: Number(parsed.price) || 0,
      currency: typeof parsed.currency === "string" ? parsed.currency : "MXN",
      terreno_m2: Number(parsed.terreno_m2) || 0,
      construccion_m2: Number(parsed.construccion_m2) || 0,
      recamaras: toPosIntOrNull(parsed.recamaras),
      banos: toPosIntOrNull(parsed.banos),
      estacionamientos: toPosIntOrNull(parsed.estacionamientos),
      antiguedad: toPosIntOrNull(parsed.antiguedad),
      description: typeof parsed.description === "string" ? parsed.description : "",
      address_text: typeof parsed.address_text === "string" ? parsed.address_text : "",
      colonia: typeof parsed.colonia === "string" ? parsed.colonia : "",
      city: typeof parsed.city === "string" ? parsed.city : "Chihuahua",
      images: Array.isArray(parsed.images)
        ? parsed.images
            .filter(
              (u) =>
                typeof u === "string" &&
                /^https?:\/\//.test(u) &&
                /img10\.naventcdn\.com\/avisos\//.test(u),
            )
            .map((u) => u.replace(/(\d{3}x\d{3})\//, "720x480/"))
            .slice(0, 20)
        : [],
      bento_highlights: Array.isArray(parsed.bento_highlights)
        ? parsed.bento_highlights.filter((h) => typeof h === "string")
        : [],
      category,
      deal_type: dealType,
      institucion_bancaria:
        typeof parsed.institucion_bancaria === "string"
          ? parsed.institucion_bancaria
          : null,
      fecha_remate:
        typeof parsed.fecha_remate === "string" ? parsed.fecha_remate : null,
      costo_reparacion_estimado:
        parsed.costo_reparacion_estimado != null &&
        !Number.isNaN(Number(parsed.costo_reparacion_estimado))
          ? Number(parsed.costo_reparacion_estimado)
          : null,
      valor_post_reparacion_estimado:
        parsed.valor_post_reparacion_estimado != null &&
        !Number.isNaN(Number(parsed.valor_post_reparacion_estimado))
          ? Number(parsed.valor_post_reparacion_estimado)
          : null,
      condiciones_traspaso:
        typeof parsed.condiciones_traspaso === "string"
          ? parsed.condiciones_traspaso
          : null,
    };
  } catch {
    return null;
  }
}

/** Fetch a detail page via Jina (markdown) with retries. Returns null on failure. */
async function fetchDetail(listing) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const markdown = await jinaFetch(listing.sourceUrl, {
        format: "markdown",
        retries: 1,
        waitSelector: ".description",
      });
      if (markdown && /venta|rec|m²|baño|casa|MN/i.test(markdown.slice(0, 4000))) {
        return markdown;
      }
    } catch {
      // retry
    }
    await sleep(3000 * attempt);
  }
  return null;
}

/* ------------------------------------------------------------------ *
 *  Geocoding
 * ------------------------------------------------------------------ */

async function geocode({ address_text, colonia, city }) {
  if (!GOOGLE_MAPS_KEY) return null;
  const query = [address_text, colonia, city, "Chihuahua", "México"]
    .filter(Boolean)
    .join(", ");
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_KEY}`,
    );
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    const result = data.results[0];
    const comps = {};
    for (const c of result.address_components ?? []) {
      for (const t of c.types) {
        if (!comps[t]) comps[t] = c.long_name;
      }
    }
    return {
      lat: result.geometry?.location?.lat ?? 0,
      lng: result.geometry?.location?.lng ?? 0,
      formatted_address: result.formatted_address ?? "",
      colonia: comps.sublocality_level_1 ?? comps.sublocality ?? "",
      city: comps.locality ?? comps.postal_town ?? "",
      state: comps.administrative_area_level_1 ?? "",
      zip_code: comps.postal_code ?? null,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 *  Slug helpers
 * ------------------------------------------------------------------ */

const TRANSLITERATION = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n",
  Á: "a", É: "e", Í: "i", Ó: "o", Ú: "u", Ü: "u", Ñ: "n",
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

async function buildUniqueSlug(title) {
  const base = slugify(title) || "propiedad";
  let candidate = base;
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ *
 *  Insert (dedupe by source_url)
 * ------------------------------------------------------------------ */

async function existsBySourceUrl(sourceUrl) {
  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("source_url", sourceUrl)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Derive created_at from published days ago so newest show first. */
function createdFromPublished(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/**
 * Extract relative published days from detail markdown. Page-2+ tiles lack the
 * "Publicado" label, but detail pages always show it ("Publicado hace 58 días").
 * Returns days ago (number) or null when unknown.
 */
function daysFromDetailMarkdown(md) {
  if (!md) return null;
  const rel = md.match(/Publicado\s+(hoy|desde ayer|hace\s+\d+\s+(?:días?|horas?|minutos?))/i);
  if (rel) {
    const label = rel[0].replace(/^Publicado\s+/i, "").toLowerCase();
    if (label === "hoy") return 0;
    if (label === "desde ayer") return 1;
    const n = label.match(/hace\s+(\d+)\s+(días?|horas?|minutos?)/i);
    if (n) {
      const count = parseInt(n[1], 10);
      const unit = n[2].toLowerCase();
      if (unit.startsWith("día")) return count;
      if (unit.startsWith("hora")) return Math.max(0, Math.round(count / 24));
      return 0;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 *  Investment classification (keyword heuristic fallback)
 * ------------------------------------------------------------------ */

/**
 * Classify a listing into category + deal_type by keyword heuristics.
 * Used as a fallback when the LLM extraction doesn't return the fields.
 */
function classifyListing(title, description) {
  const haystack = `${title} ${description ?? ""}`.toLowerCase();

  let category = "casa";
  if (/\b(terreno|predio|lote|solar|parcela)\b/.test(haystack)) {
    category = "terreno";
  } else if (/\b(bodega|nave)\b/.test(haystack)) {
    category = "bodega";
  } else if (/\b(local|oficina|nave industrial)\b/.test(haystack)) {
    category = "local";
  } else if (/\b(depto|departamento)\b/.test(haystack)) {
    category = "departamento";
  }

  let dealType = "venta_directa";
  if (/\b(remate|adjudicaci[oó]n|ejecuci[oó]n hipotecaria|banco|bancario)\b/.test(haystack)) {
    dealType = "remate_bancario";
  } else if (/\b(traspaso|ceder|c[eé]dula)\b/.test(haystack)) {
    dealType = "traspaso";
  } else if (/\b(flipping|reparar|remodelar|reconstruir|para arreglar|proyecto de inversi[oó]n)\b/.test(haystack)) {
    dealType = "flipping";
  }

  return { category, dealType };
}

/** Extract an MXN amount (e.g. "$250,000" or "250000") or null. */
function extractAmount(text) {
  if (!text) return null;
  const match = text.replace(/\$/g, "").replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) || null : null;
}

async function insertProperty(listing, extracted, geocoded, forcedDealType = null) {
  if (await existsBySourceUrl(listing.sourceUrl)) {
    console.log(`  skip (ya existe): ${listing.sourceUrl}`);
    return "skipped";
  }

  const images = extracted?.images?.length ? extracted.images : listing.images;
  const title = extracted?.title || listing.title;
  const slug = await buildUniqueSlug(title);
  const address = geocoded?.formatted_address || extracted?.address_text || listing.address;
  const price = extracted?.price || listing.price;
  const terreno_m2 = extracted?.terreno_m2 || listing.terreno_m2;
  const construccion_m2 = extracted?.construccion_m2 || listing.construccion_m2;
  const recamaras = toPosIntOrNull(extracted?.recamaras ?? listing.recamaras);
  const banos = toPosIntOrNull(extracted?.banos ?? listing.banos);
  const estacionamientos = toPosIntOrNull(extracted?.estacionamientos ?? listing.estacionamientos);
  const antiguedad = toPosIntOrNull(extracted?.antiguedad ?? listing.antiguedad);
  const description = extracted?.description || listing.description || "";
  const contactName = extracted?.contact_name || listing.contactName || null;
  const contactType = extracted?.contact_type || listing.contactType || null;
  const contactPhone =
    extracted?.contact_phone ||
    listing.contactPhone ||
    extractMxPhone(description) ||
    null;

  // Classify the listing; LLM extraction wins, keyword heuristic is the fallback.
  const heuristic = classifyListing(title, description);
  const category = extracted?.category || heuristic.category;
  const dealType = forcedDealType || extracted?.deal_type || heuristic.dealType;
  const costoReparacion =
    extracted?.costo_reparacion_estimado ??
    (dealType === "flipping" ? extractAmount(description) : null);
  const valorPostReparacion =
    extracted?.valor_post_reparacion_estimado ??
    (dealType === "flipping" ? extractAmount(extracted?.description) : null);

  const row = {
    owner_id: OWNER_ID,
    title,
    slug,
    description,
    type: "sale",
    category,
    deal_type: dealType,
    costo_reparacion_estimado: costoReparacion,
    valor_post_reparacion_estimado: valorPostReparacion,
    institucion_bancaria: extracted?.institucion_bancaria ?? null,
    fecha_remate: extracted?.fecha_remate ?? null,
    condiciones_traspaso: extracted?.condiciones_traspaso ?? null,
    status: "active",
    current_wizard_step: 4,
    contact_name: contactName,
    contact_type: contactType,
    contact_phone: contactPhone,
    contact_whatsapp: contactPhone ?? null,
    contact_email: extracted?.contact_email ?? null,
    price,
    currency: "MXN",
    terreno_m2,
    construccion_m2,
    recamaras,
    banos,
    estacionamientos,
    antiguedad,
    address,
    colonia: geocoded?.colonia || extracted?.colonia || "",
    city: geocoded?.city || extracted?.city || "Chihuahua",
    state: geocoded?.state || "Chihuahua",
    zip_code: geocoded?.zip_code ?? null,
    lat: geocoded?.lat ?? 0,
    lng: geocoded?.lng ?? 0,
    images,
    source_url: listing.sourceUrl,
    created_at: createdFromPublished(listing.publishedDays),
    updated_at: new Date().toISOString(),
  };

  if (dryRun) {
    console.log(`  [dry-run] insertaría: ${title} — $${price} — ${address}`);
    return "dry-run";
  }

  const { data, error } = await supabase.from("properties").insert(row).select("id, slug");
  if (error) {
    console.error(`  ERROR insertando ${title}: ${error.message}`);
    return "error";
  }
  console.log(`  ✓ insertado ${data?.[0]?.id ?? ""} — ${title} — $${price}`);
  return "inserted";
}

/* ------------------------------------------------------------------ *
 *  Main
 * ------------------------------------------------------------------ */

async function main() {
  const modeLabel = rematesMode ? "remates bancarios" : "venta, precios bajados";
  console.log(
    `Scraping Vivanuncios Chihuahua (${modeLabel}) — pages=${pageCount} limit=${maxListings} dryRun=${dryRun}`,
  );

  const allListings = [];
  const seen = new Set();

  for (let page = 1; page <= pageCount; page++) {
    const template =
      page === 1
        ? rematesMode
          ? REMATES_URL_TEMPLATE
          : SEARCH_URL_TEMPLATE
        : rematesMode
          ? REMATES_URL_TEMPLATE_NO_SORT
          : SEARCH_URL_TEMPLATE_NO_SORT;
    const url = template.replace("{PAGE}", page);
    console.log(`\n=== Página ${page} ===`);
    try {
      const html = await jinaFetch(url, { format: "html", retries: 4, waitSelector: ".tileV2" });
      const listings = parseSearchPage(html);
      console.log(`  ${listings.length} listings en la página`);
      let added = 0;
      for (const l of listings) {
        if (seen.has(l.id)) continue;
        seen.add(l.id);
        allListings.push(l);
        added++;
      }
      console.log(`  ${added} nuevos`);
      if (allListings.length >= maxListings) break;
    } catch (err) {
      console.error(`  Falló página ${page}: ${err.message}`);
      // Keep going to later pages (page 2+ is often Cloudflare-blocked).
      await sleep(5000);
    }
  }

  // Ordenar por publicación (más recientes primero)
  allListings.sort((a, b) => a.publishedDays - b.publishedDays);
  const toImport = allListings.slice(0, maxListings);

  console.log(`\nTotal únicos: ${allListings.length} — a importar: ${toImport.length}`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < toImport.length; i++) {
    const listing = toImport[i];
    console.log(`\n[${i + 1}/${toImport.length}] ${listing.title} (${listing.publishedLabel || "?"})`);
    console.log(`  ${listing.sourceUrl}`);

    // Try detail page → DeepSeek extraction. With --skip-detail (remate detail
    // pages are Cloudflare-blocked) skip the retry loop and use tile data.
    let extracted = null;
    const markdown = skipDetail ? null : await fetchDetail(listing);
    if (markdown) {
      // Page-2+ tiles have no "Publicado" label; the detail page always does.
      if (!listing.publishedLabel) {
        const days = daysFromDetailMarkdown(markdown);
        if (days !== null) {
          listing.publishedDays = days;
          listing.publishedLabel = `hace ${days} días`;
          console.log(`  fecha del detalle: ${listing.publishedLabel}`);
        }
      }
      extracted = await extractFromDetail(markdown, listing.title);
      if (extracted) {
        console.log(
          `  detalle: ${extracted.title} — $${extracted.price} — ${extracted.construccion_m2}m² const`,
        );
      }
    } else {
      console.log("  detalle no disponible (Cloudflare) — usando datos del tile");
    }

    const geocoded = await geocode({
      address_text: extracted?.address_text || listing.address.split(",")[0] || "",
      colonia: extracted?.colonia || "",
      city: extracted?.city || "Chihuahua",
    });
    if (geocoded) console.log(`  geo: ${geocoded.lat.toFixed(4)}, ${geocoded.lng.toFixed(4)}`);

    const result = await insertProperty(
      listing,
      extracted,
      geocoded,
      rematesMode ? "remate_bancario" : null,
    );
    if (result === "inserted") inserted++;
    else if (result === "skipped") skipped++;
    else if (result === "error") failed++;

    // Be gentle with Cloudflare between listings.
    await sleep(1500);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Insertados: ${inserted}`);
  console.log(`Saltados (ya existían): ${skipped}`);
  console.log(`Errores: ${failed}`);
  if (dryRun) console.log("(dry-run — no se escribió en la base)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
