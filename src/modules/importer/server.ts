import "server-only";

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
 * Ask DeepSeek to extract structured property data from scraped page
 * content. Returns null when DEEPSEEK_API_KEY is unset or on any failure.
 */
export async function extractPropertyFromMarkdown(
  markdown: string,
): Promise<ExtractedProperty | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              'You extract real-estate listing data from scraped web pages for the Mexican market. Respond ONLY with a JSON object, no markdown, no commentary. Schema:\n{\n  "title": string (short listing title, Spanish),\n  "price": number (integer MXN sale price, 0 if unknown),\n  "currency": "MXN",\n  "terreno_m2": number (land area m2, 0 if unknown),\n  "construccion_m2": number (built area m2, 0 if unknown),\n  "description": string (2-4 sentence Spanish description),\n  "address_text": string (street + number if present),\n  "colonia": string,\n  "city": string,\n  "images": array of absolute https image URLs (extract from og:image, img tags, or JSON-LD; max 20; only https),\n  "bento_highlights": array of 3-6 short Spanish highlight phrases (e.g. "A 5 min del metro", "Vista panorámica")\n}',
          },
          {
            role: "user",
            content: `Extract the listing data from this page content:\n\n${markdown.slice(0, 18000)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const raw = JSON.parse(content) as Record<string, unknown>;
    if (typeof raw !== "object" || raw === null) return null;

    const images = Array.isArray(raw.images)
      ? raw.images.filter(isValidImageUrl).slice(0, 20)
      : [];
    const bentoHighlights = Array.isArray(raw.bento_highlights)
      ? raw.bento_highlights.filter((item): item is string => typeof item === "string")
      : [];

    return {
      title: toStringOrEmpty(raw.title),
      price: toNumber(raw.price),
      currency: toStringOrEmpty(raw.currency) || "MXN",
      terreno_m2: toNumber(raw.terreno_m2),
      construccion_m2: toNumber(raw.construccion_m2),
      description: toStringOrEmpty(raw.description),
      address_text: toStringOrEmpty(raw.address_text),
      colonia: toStringOrEmpty(raw.colonia),
      city: toStringOrEmpty(raw.city),
      images,
      bento_highlights: bentoHighlights,
    };
  } catch {
    return null;
  }
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
 * Orchestrate the full import pipeline: fetch → extract → geocode.
 */
export async function importPropertyFromUrl(
  url: string,
): Promise<
  | { ok: true; data: ImportedPropertyDraft }
  | { ok: false; error: string; status: number }
> {
  const content = await fetchPageContent(url);
  if (!content) {
    return {
      ok: false,
      error: "No se pudo leer el contenido de la página (puede estar bloqueada).",
      status: 422,
    };
  }

  const extracted = await extractPropertyFromMarkdown(content);
  if (!extracted) {
    return {
      ok: false,
      error:
        "No se pudo extraer la propiedad con IA. Verifica DEEPSEEK_API_KEY o que el enlace sea una publicación válida.",
      status: 422,
    };
  }

  const geocoded = await geocodeAddress({
    address_text: extracted.address_text,
    colonia: extracted.colonia,
    city: extracted.city,
  });

  const lat = geocoded?.lat ?? MEXICO_CITY_CENTER.lat;
  const lng = geocoded?.lng ?? MEXICO_CITY_CENTER.lng;
  const address = geocoded?.formatted_address || extracted.address_text;

  const data: ImportedPropertyDraft = {
    title: extracted.title || "Propiedad importada",
    price: extracted.price,
    currency: extracted.currency || "MXN",
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

  return { ok: true, data };
}
