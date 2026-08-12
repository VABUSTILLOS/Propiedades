import "server-only";

import { chatCompletion } from "@/modules/ai/server";
import { env } from "@/modules/lib/env";
import type { ImportedPropertyDraft } from "@/modules/importer/schemas";

/**
 * Universal property importer: fetch a listing page, extract structured data
 * with DeepSeek, geocode the address, and produce a draft ready for
 * createImportedDraft.
 */

const JINA_API_KEY = process.env.JINA_API_KEY ?? "";

export type ExtractedProperty = {
  title: string;
  price: number;
  currency: string;
  category: "casa" | "departamento" | "local" | "bodega" | "terreno";
  deal_type: "venta_directa" | "remate_bancario" | "flipping" | "traspaso";
  costo_reparacion_estimado: number | null;
  valor_post_reparacion_estimado: number | null;
  institucion_bancaria: string | null;
  fecha_remate: string | null;
  condiciones_traspaso: string | null;
  terreno_m2: number;
  construccion_m2: number;
  description: string;
  address_text: string;
  colonia: string;
  city: string;
  images: string[];
  bento_highlights: string[];
};

/**
 * Fetch a listing page's content as text, preferring the Jina AI Reader
 * (which returns readable markdown) and falling back to a raw HTML fetch.
 */
export async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "markdown",
        ...(JINA_API_KEY ? { Authorization: `Bearer ${JINA_API_KEY}` } : {}),
      },
      cache: "no-store",
    });
    if (jinaRes.ok) {
      const text = await jinaRes.text();
      if (text.trim()) return text;
    }
  } catch {
    // fall through to plain fetch
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,text/plain",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    const trimmed = text.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

/**
 * Convert raw HTML (e.g. captured from the user's authenticated browser) into
 * readable text for the AI extractor. Strips scripts/styles/tags, decodes
 * common entities, and collects absolute image URLs so listings keep photos.
 */
export function htmlToReadableText(html: string): {
  text: string;
  images: string[];
} {
  const images = new Set<string>();
  for (const match of html.matchAll(
    /<img[^>]+(?:src|data-src|data-lazy-src)=["'](https?:\/\/[^"']+)["']/gi,
  )) {
    const src = match[1] ?? "";
    if (src && !src.includes("placeholder") && !src.includes("static.xx.fbcdn")) {
      images.add(src);
    }
  }
  // og:image is often the highest-quality listing photo.
  for (const match of html.matchAll(
    /<meta[^>]+property=["']og:image["'][^>]+content=["'](https?:\/\/[^"']+)["']/gi,
  )) {
    images.add(match[1] ?? "");
  }
  for (const match of html.matchAll(
    /<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]+property=["']og:image["']/gi,
  )) {
    images.add(match[1] ?? "");
  }

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  return { text: stripped.trim(), images: [...images].slice(0, 20) };
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isValidImageUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("http://") || value.startsWith("https://"))
  );
}

/**
 * Ask the configured AI provider (DeepSeek primary, kie.ai fallback) to extract
 * structured property data from scraped page content. Returns null when no
 * provider key is set or on any failure.
 */
export async function extractPropertyFromMarkdown(
  markdown: string,
): Promise<ExtractedProperty | null> {
  const result = await chatCompletion({
    jsonMode: true,
    temperature: 0.1,
    maxTokens: 1500,
    system:
      'You extract real-estate listing data from scraped web pages for the Mexican market. Respond ONLY with a JSON object, no markdown, no commentary. Schema:\n{\n  "title": string (short listing title, Spanish),\n  "price": number (integer MXN sale price, 0 if unknown),\n  "currency": "MXN",\n  "category": one of "casa","departamento","local","bodega","terreno" (property kind; infer from title/description),\n  "deal_type": one of "venta_directa","remate_bancario","flipping","traspaso" (default "venta_directa"; use "remate_bancario" for bank foreclosures/subastas/judicial, "flipping" for fixer-upper/reparar/renovar, "traspaso" for contract transfers/traspasos; "casa" if unclear),\n  "costo_reparacion_estimado": number|null (MXN, expected repair budget for flipping, else null),\n  "valor_post_reparacion_estimado": number|null (MXN, after-repair value / ARV for flipping, else null),\n  "institucion_bancaria": string|null (bank or institution for remate_bancario, else null),\n  "fecha_remate": string|null (auction date YYYY-MM-DD for remate_bancario, else null),\n  "condiciones_traspaso": string|null (transfer terms for traspaso, else null),\n  "terreno_m2": number (land area m2, 0 if unknown),\n  "construccion_m2": number (built area m2, 0 if unknown),\n  "description": string (2-4 sentence Spanish description),\n  "address_text": string (street + number if present),\n  "colonia": string,\n  "city": string,\n  "images": array of absolute https image URLs (extract from og:image, img tags, or JSON-LD; max 20; only https),\n  "bento_highlights": array of 3-6 short Spanish highlight phrases (e.g. "A 5 min del metro", "Vista panorámica")\n}',
    user: `Extract the listing data from this page content:\n\n${markdown.slice(0, 18000)}`,
  });
  const content = result?.content;
  if (!content) return null;

  // Some providers (Gemini via kie.ai) wrap JSON mode output in ```json fences.
  let parsed: unknown;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  try {
    parsed = JSON.parse((fenced && fenced[1]) ?? content);
  } catch {
    return null;
  }

  const raw = parsed as Record<string, unknown> | null;
  if (typeof raw !== "object" || raw === null) return null;

  const images = Array.isArray(raw.images)
    ? raw.images.filter(isValidImageUrl).slice(0, 20)
    : [];
  const bentoHighlights = Array.isArray(raw.bento_highlights)
    ? raw.bento_highlights.filter((item): item is string => typeof item === "string")
    : [];

  const categoryRaw = toStringOrEmpty(raw.category).toLowerCase();
  const dealTypeRaw = toStringOrEmpty(raw.deal_type).toLowerCase();
  const categories = ["casa", "departamento", "local", "bodega", "terreno"];
  const dealTypes = ["venta_directa", "remate_bancario", "flipping", "traspaso"];

  return {
    title: toStringOrEmpty(raw.title),
    price: toNumber(raw.price),
    currency: toStringOrEmpty(raw.currency) || "MXN",
    category: (categories.includes(categoryRaw)
      ? categoryRaw
      : "casa") as ExtractedProperty["category"],
    deal_type: (dealTypes.includes(dealTypeRaw)
      ? dealTypeRaw
      : "venta_directa") as ExtractedProperty["deal_type"],
    costo_reparacion_estimado:
      raw.costo_reparacion_estimado == null ? null : toNumber(raw.costo_reparacion_estimado),
    valor_post_reparacion_estimado:
      raw.valor_post_reparacion_estimado == null
        ? null
        : toNumber(raw.valor_post_reparacion_estimado),
    institucion_bancaria: toStringOrEmpty(raw.institucion_bancaria) || null,
    fecha_remate: toStringOrEmpty(raw.fecha_remate) || null,
    condiciones_traspaso: toStringOrEmpty(raw.condiciones_traspaso) || null,
    terreno_m2: toNumber(raw.terreno_m2),
    construccion_m2: toNumber(raw.construccion_m2),
    description: toStringOrEmpty(raw.description),
    address_text: toStringOrEmpty(raw.address_text),
    colonia: toStringOrEmpty(raw.colonia),
    city: toStringOrEmpty(raw.city),
    images,
    bento_highlights: bentoHighlights,
  };
}

export type GeocodeResult = {
  lat: number;
  lng: number;
  formatted_address: string;
  colonia: string;
  city: string;
  state: string;
  zip_code: string | null;
};

type GoogleGeocodeAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResponse = {
  status: string;
  results?: {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    address_components: GoogleGeocodeAddressComponent[];
  }[];
};

/**
 * Geocode a partial address via the Google Maps Geocoding API.
 * Returns null when GOOGLE_MAPS_SERVER_KEY (or its public fallback) is unset,
 * or when the API returns no usable result.
 */
export async function geocodeAddress(input: {
  address_text: string;
  colonia: string;
  city: string;
}): Promise<GeocodeResult | null> {
  const key = env.googleMapsServerKey;
  if (!key) return null;

  const address = [input.address_text, input.colonia, input.city]
    .filter(Boolean)
    .join(", ");
  if (!address) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address,
    )}&components=country:MX&key=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const data = (await res.json()) as GoogleGeocodeResponse;
    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    if (!result) return null;
    let colonia = "";
    let city = "";
    let state = "";
    let zipCode: string | null = null;

    for (const component of result.address_components) {
      if (
        component.types.includes("sublocality_level_1") ||
        component.types.includes("neighborhood")
      ) {
        colonia = component.long_name;
      } else if (
        component.types.includes("locality") ||
        component.types.includes("administrative_area_level_2")
      ) {
        city = component.long_name;
      } else if (component.types.includes("administrative_area_level_1")) {
        state = component.long_name;
      } else if (component.types.includes("postal_code")) {
        zipCode = component.long_name;
      }
    }

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      colonia: colonia || input.colonia,
      city: city || input.city,
      state,
      zip_code: zipCode,
    };
  } catch {
    return null;
  }
}

const MEXICO_CITY_CENTER = { lat: 19.4326, lng: -99.1332 };

/**
 * Turn an ExtractedProperty + geocoding into the final draft payload.
 */
async function buildDraft(
  extracted: ExtractedProperty,
  url: string,
): Promise<ImportedPropertyDraft> {
  const geocoded = await geocodeAddress({
    address_text: extracted.address_text,
    colonia: extracted.colonia,
    city: extracted.city,
  });

  const lat = geocoded?.lat ?? MEXICO_CITY_CENTER.lat;
  const lng = geocoded?.lng ?? MEXICO_CITY_CENTER.lng;
  const address = geocoded?.formatted_address || extracted.address_text;

  return {
    title: extracted.title || "Propiedad importada",
    price: extracted.price,
    currency: extracted.currency || "MXN",
    category: extracted.category,
    deal_type: extracted.deal_type,
    costo_reparacion_estimado: extracted.costo_reparacion_estimado,
    valor_post_reparacion_estimado: extracted.valor_post_reparacion_estimado,
    institucion_bancaria: extracted.institucion_bancaria,
    fecha_remate: extracted.fecha_remate,
    condiciones_traspaso: extracted.condiciones_traspaso,
    terreno_m2: extracted.terreno_m2,
    construccion_m2: extracted.construccion_m2,
    description: extracted.description,
    address,
    colonia: geocoded?.colonia || extracted.colonia,
    city: geocoded?.city || extracted.city,
    state: geocoded?.state || "",
    zip_code: geocoded?.zip_code ?? null,
    lat,
    lng,
    images: extracted.images,
    bento_highlights: extracted.bento_highlights,
    source_url: url,
  };
}

type ImportResult =
  | { ok: true; data: ImportedPropertyDraft }
  | { ok: false; error: string; status: number };

/**
 * Orchestrate the full import pipeline: fetch → extract → geocode.
 */
export async function importPropertyFromUrl(url: string): Promise<ImportResult> {
  const content = await fetchPageContent(url);
  if (!content) {
    return {
      ok: false,
      error: "No se pudo leer el contenido de la página (puede estar bloqueada).",
      status: 422,
    };
  }

  return importPropertyFromContent(content, url);
}

/**
 * Import a property from content captured directly from the user's browser
 * (e.g. a logged-in Facebook Marketplace tab that blocks server-side fetch).
 * Accepts raw HTML or readable text; HTML is normalized to text first.
 */
export async function importPropertyFromContent(
  rawContent: string,
  url: string,
): Promise<ImportResult> {
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(rawContent);
  let content = rawContent;
  let capturedImages: string[] = [];

  if (looksLikeHtml) {
    const normalized = htmlToReadableText(rawContent);
    content = normalized.text;
    capturedImages = normalized.images;
  }

  if (!content.trim()) {
    return {
      ok: false,
      error: "El contenido capturado está vacío. Copia el anuncio completo de Facebook y vuelve a intentarlo.",
      status: 422,
    };
  }

  const extracted = await extractPropertyFromMarkdown(content);
  if (!extracted) {
    return {
      ok: false,
      error:
        "No se pudo extraer la propiedad con IA. Verifica DEEPSEEK_API_KEY o KIEAI_API_KEY o que el enlace sea una publicación válida.",
      status: 422,
    };
  }

  // Prefer images found in the captured HTML when the AI didn't return any.
  if (extracted.images.length === 0 && capturedImages.length > 0) {
    extracted.images = capturedImages;
  }

  const data = await buildDraft(extracted, url);
  return { ok: true, data };
}
