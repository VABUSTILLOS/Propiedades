import "server-only";

import { chatCompletion } from "@/modules/ai/server";
import { embeddingsConfigured, searchSemantic } from "@/modules/ai/embeddings";
import { extractFilters } from "@/modules/chat/extract";
import { findKnownCity, interpretQuery, normalizeCityName, priorityKeyword } from "@/modules/chat/interpret";
import type { ChatFilters, ChatResult, ChatResponse } from "@/modules/chat/types";
import { searchListings } from "@/modules/search/queries";
import type { PropertiesRow } from "@/modules/lib/database.types";

/**
 * Chat orchestration pipeline:
 *   1. Interpret the message (LLM extraction → regex fallback).
 *   2. Merge with the previous turn's filters so follow-ups like
 *      "y más baratas" keep the city/context of the first query.
 *   3. Search active listings (capped for chat display).
 *   4. Build a natural reply (LLM when available, templated fallback).
 *
 * By default the search is STRICT: filters are never silently relaxed, so a
 * request with no exact matches returns an honest "no encontré" reply instead
 * of unrelated properties. The client can opt into relaxed "alternativas"
 * (see `mode: "alternatives"`), where filters are dropped one at a time but
 * every result is labelled so the user knows what was relaxed.
 *
 * Returns the reply, the matching results, and the filters that produced
 * them (so the client can pass `previousFilters` on the next message).
 */

const CHAT_RESULT_LIMIT = 6;

/** Full-width fallback for when the merged filters changed but not the request. */
type TemplateContext = {
  count: number;
  type?: "sale" | "rent";
  city?: string;
  maxPrice?: number;
  query?: string;
  /** Known city (no inventory) that the user asked about. */
  knownCity?: string;
  /** Cities that DO have inventory, for the honest no-inventory reply. */
  cities?: string[];
  /** Human-readable note appended when some filters were dropped to find results. */
  relaxedNote?: string;
};

function buildTemplateReply(ctx: TemplateContext): string {
  const what = ctx.type === "rent" ? "rentas" : ctx.type === "sale" ? "propiedades en venta" : "propiedades";
  const where = ctx.city ? ` en ${ctx.city}` : "";
  const budget = ctx.maxPrice != null ? ` por menos de $${ctx.maxPrice.toLocaleString("es-MX")} MXN` : "";
  const keyword = ctx.query ? ` que coincidan con "${ctx.query}"` : "";

  if (ctx.count === 0) {
    if (ctx.knownCity) {
      const coverage = ctx.cities?.length
        ? ` Hoy publico propiedades en ${ctx.cities.join(", ")}.`
        : "";
      const rentHint = ctx.type === "rent" ? " No tengo rentas en el catálogo por ahora, solo venta." : "";
      return `No tengo inventario aún en ${ctx.knownCity}.${coverage}${rentHint} Prueba ajustar la ciudad o pide "ver alternativas".`;
    }
    const rentHint = ctx.type === "rent" ? " No tengo rentas en el catálogo por ahora, solo venta." : "";
    return `No encontré ${what}${where}${budget}${keyword}.${rentHint} Prueba ajustar el precio o la ubicación, o pide "ver alternativas".`;
  }
  const noun = ctx.count === 1 ? "resultado" : "resultados";
  const note = ctx.relaxedNote ? ` ${ctx.relaxedNote}` : "";
  return `Encontré ${ctx.count} ${noun}${where}${budget}${keyword}.${note}`;
}

function toChatResult(row: PropertiesRow, relaxed?: boolean): ChatResult {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    city: row.city,
    colonia: row.colonia,
    price: row.price,
    currency: row.currency,
    type: row.type,
    image: row.images?.[0] ?? null,
    score: row.property_score,
    recamaras: row.recamaras,
    banos: row.banos,
    estacionamientos: row.estacionamientos,
    antiguedad: row.antiguedad,
    construccion_m2: row.construccion_m2,
    terreno_m2: row.terreno_m2,
    relaxed,
  };
}

/** Interpret the message, preferring the LLM and falling back to regex. */
export async function interpretMessage(message: string, cities: string[]): Promise<ChatFilters> {
  const llmFilters = await extractFilters(message, cities);
  if (llmFilters && Object.keys(llmFilters).length > 0) {
    // The LLM often omits `query` even for category words ("casas", "terreno"),
    // which lets unrelated listings (land, warehouses) leak into the results.
    // Merge the regex-derived high-value keyword so "casas" still excludes
    // terrain and vice versa. The regex keyword is only a *priority* keyword,
    // so a refinement like "y más baratas" never overrides a previous query.
    if (!llmFilters.query) {
      const keyword = priorityKeyword(message);
      if (keyword) llmFilters.query = keyword;
    }
    return llmFilters;
  }
  return interpretQuery(message, cities);
}

/** Merge new filters over the previous turn, keeping earlier context. */
export function mergeFilters(previous: ChatFilters | undefined, next: ChatFilters): ChatFilters {
  return { ...previous, ...next };
}

/** Natural-language reply. Prefers the LLM; falls back to a clean template.
 * When filters were relaxed, the template is used directly: it is the only
 * variant guaranteed not to re-assert a dropped filter (e.g. claiming "casas"
 * after the keyword was removed). */
async function buildReply(
  count: number,
  filters: ChatFilters,
  userMessage: string,
  relaxedNote?: string,
  knownCity?: string,
  cities?: string[],
): Promise<string> {
  const template = () =>
    buildTemplateReply({
      count,
      type: filters.type,
      city: filters.city,
      maxPrice: filters.maxPrice,
      query: filters.query,
      knownCity,
      cities,
      relaxedNote,
    });

  if (relaxedNote) return template();

  const result = await chatCompletion({
    temperature: 0.5,
    maxTokens: 120,
    system:
      "You are a friendly Mexican real-estate assistant. Reply in Spanish, 1–2 short sentences, " +
      "no markdown, no emoji. State how many listings you found and the filters applied. " +
      "If none were found, suggest adjusting price or location. " +
      (knownCity
        ? `The user asked about ${knownCity}, where we have no inventory yet. Say so honestly and list the cities where we DO have inventory (${cities?.join(", ") ?? "none"}). Never show listings from other cities as if they were in ${knownCity}.`
        : "") +
      (relaxedNote ? `Note: ${relaxedNote}` : ""),
    user:
      `User said: "${userMessage}"\n` +
      `Filters applied: ${JSON.stringify(filters)}\n` +
      `Listings found: ${count}`,
  });

  const content = result?.content?.trim();
  if (content && content.length <= 300) return content;
  return template();
}

/** True when the property satisfies the structured chat filters (semantic
 * hits are ranked by similarity only, so filters must be re-applied here). */
function passesChatFilters(row: PropertiesRow, f: ChatFilters): boolean {
  if (f.type && row.type !== f.type) return false;
  if (f.city && row.city !== f.city) return false;
  if (f.colonia && row.colonia !== f.colonia) return false;
  if (f.isLand && row.category !== "terreno") return false;
  if (f.minPrice != null && row.price < f.minPrice) return false;
  if (f.maxPrice != null && row.price > f.maxPrice) return false;
  if (f.minBedrooms != null && (row.recamaras ?? 0) < f.minBedrooms) return false;
  const m2 = f.isLand ? row.terreno_m2 : row.construccion_m2;
  if (f.minM2 != null && m2 < f.minM2) return false;
  if (f.maxM2 != null && m2 > f.maxM2) return false;
  return true;
}

/** Fuse Gemini semantic matches into the keyword results (deduped, capped).
 * Keyword hits (which already respect filters) stay first; semantic hits fill
 * the remaining slots when they also pass the filters. */
async function fuseSemanticMatches(
  rows: PropertiesRow[],
  filters: ChatFilters,
  query: string,
): Promise<PropertiesRow[]> {
  if (!filters.query || !embeddingsConfigured()) return rows;
  if (rows.length >= CHAT_RESULT_LIMIT) return rows;

  const semantic = await searchSemantic(query, 12);
  if (semantic.length === 0) return rows;

  const seen = new Set(rows.map((r) => r.id));
  const merged = [...rows];
  for (const row of semantic) {
    if (merged.length >= CHAT_RESULT_LIMIT) break;
    if (seen.has(row.id)) continue;
    if (!passesChatFilters(row, filters)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

/** Run the full search pipeline for a chat message.
 *
 * @param options.mode "strict" (default) returns an honest no-results reply
 *   when nothing matches. "alternatives" drops filters one at a time to show
 *   "alternativas", labelling every relaxed result. `type` (sale/rent) is
 *   never dropped so we never present sale listings as rent and vice versa.
 */
/** True when the message is a bare "ver alternativas" command (no search
 * terms of its own). In that case we must NOT interpret it as a search for
 * the word "alternativa" — we keep the previous turn's filters and just run
 * them in alternatives mode. */
export function isAlternativesCommand(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (!/(?:ver|mu[eé]strame|dame|quiero)\s+alternativas?\b|alternativas?\s*$/i.test(text)) {
    return false;
  }
  // No city, price, type or category intent in the same message.
  return !/(en\s+[a-záéíóúñü]{3,}|menor|menos|mayor|más|de\s+\$\d|\d[\d.,]*\s*m[²2]|\b(renta|venta|terreno|lote|casa|departamento|bodega)\b)/i.test(text);
}

export async function runChatSearch(
  message: string,
  cities: string[],
  previousFilters?: ChatFilters,
  options: { mode?: "strict" | "alternatives" } = {},
): Promise<ChatResponse> {
  const mode = options.mode ?? "strict";
  const extracted = isAlternativesCommand(message)
    ? {}
    : await interpretMessage(message, cities);
  const filters = mergeFilters(previousFilters, extracted);

  // A known city must never resolve to listings in other cities. When the user
  // names a known city, override any stale city from a previous turn: pin the
  // catalog spelling when that city IS in the catalog, otherwise clear the
  // city filters entirely and (in strict mode) answer honestly that there is
  // no inventory there yet.
  const mentionedCity = findKnownCity(message);
  let knownCityNoInventory: string | undefined;
  if (mentionedCity) {
    const catalogCity = normalizeCityName(mentionedCity, cities);
    if (catalogCity) {
      filters.city = catalogCity;
    } else {
      knownCityNoInventory = mentionedCity;
      // Keep the named city in the filters for the alternatives ladder so the
      // "ciudad" step is a real drop (and reported). In strict mode we clear
      // it before answering honestly, since we never search by it.
      if (mode === "strict") {
        delete filters.city;
        delete filters.colonia;
      } else {
        filters.city = mentionedCity;
      }
    }
  } else if (
    mode === "alternatives" &&
    filters.city &&
    !normalizeCityName(filters.city, cities)
  ) {
    // A "ver alternativas" follow-up carries the city from the previous turn
    // (saved in chat state) but names no city itself. If that city is a known
    // place with no catalog inventory, treat it like a named known city so the
    // ladder relaxes the CITY first (keeping the user's keyword, e.g. "casas").
    knownCityNoInventory = filters.city;
  }

  const search = (f: ChatFilters) =>
    searchListings({
      ...f,
      limit: CHAT_RESULT_LIMIT,
      sortBy: "newest",
    });

  // Strict mode + known city without inventory: answer honestly, never relax
  // the city (or anything else) to fill the screen with unrelated listings.
  if (knownCityNoInventory && mode === "strict") {
    const reply = await buildReply(0, filters, message, undefined, knownCityNoInventory, cities);
    // Retain the named city in the returned filters so a follow-up
    // "ver alternativas" can relax *that* city (the search itself never used
    // it; the honest reply already explains the situation).
    filters.city = mentionedCity;
    return {
      reply,
      results: [],
      filters,
      matched: false,
    };
  }

  let rows = await search(filters);
  let relaxed: ChatResponse["relaxed"];
  // Filters that actually produced the results. In strict mode this equals
  // `filters`; after relaxing, it reflects the drops so the reply text never
  // claims the results match a filter that was dropped.
  let appliedFilters = filters;

  // In strict mode we never relax filters silently: an empty result is an
  // honest answer, not a licence to show unrelated properties.
  if (rows.length === 0 && mode === "alternatives") {
    // Drop the least specific filters one at a time so a too-narrow keyword
    // or city still surfaces *something* — but every result is labelled so
    // the user knows what was relaxed. type is deliberately excluded.
    const relaxedFilters = { ...filters };
    // When the user named a known city with no inventory, the city is the
    // obvious thing to relax first ("show me casas elsewhere"), not the
    // keyword. Otherwise drop least-specific filters first.
    const dropSteps: Array<{ name: string; drop: (f: ChatFilters) => void }> = knownCityNoInventory
      ? [
          {
            name: "ciudad",
            drop: (f) => { delete f.city; delete f.colonia; },
          },
          {
            name: `búsqueda ("${filters.query}")`,
            drop: (f) => { delete f.query; },
          },
          {
            name: "precio",
            drop: (f) => { delete f.minPrice; delete f.maxPrice; },
          },
          {
            name: "tamaño o recámaras",
            drop: (f) => { delete f.minM2; delete f.maxM2; delete f.minBedrooms; },
          },
        ]
      : [
          {
            name: `búsqueda ("${filters.query}")`,
            drop: (f) => { delete f.query; },
          },
          {
            name: "ciudad",
            drop: (f) => { delete f.city; delete f.colonia; },
          },
          {
            name: "precio",
            drop: (f) => { delete f.minPrice; delete f.maxPrice; },
          },
          {
            name: "tamaño o recámaras",
            drop: (f) => { delete f.minM2; delete f.maxM2; delete f.minBedrooms; },
          },
        ];
    const dropped: string[] = [];
    for (const step of dropSteps) {
      const before = JSON.stringify(relaxedFilters);
      step.drop(relaxedFilters);
      if (JSON.stringify(relaxedFilters) === before) continue; // nothing to drop
      dropped.push(step.name);
      rows = await search(relaxedFilters);
      if (rows.length > 0) break;
    }
    if (rows.length > 0) {
      appliedFilters = relaxedFilters;
      const note = knownCityNoInventory
        ? `No tenemos inventario en ${knownCityNoInventory}; mostrando alternativas en otras ciudades.`
        : `Mostrando alternativas sin filtro de ${dropped.join(" y ")}.`;
      relaxed = { dropped, note };
    }
  }

  // Semantic fusion: when the user typed a keyword and Gemini embeddings are
  // configured, rank the query vector against all active listings and fill
  // the remaining slots with matches that also pass the structured filters.
  // Without a GEMINI_API_KEY this is a no-op and the pipeline stays keyword-only.
  // Skipped when relaxation dropped the query: re-adding keyword-ranked rows
  // would silently restore the very filter the user asked to remove.
  if (appliedFilters.query && !relaxed?.dropped.some((d) => d.startsWith("búsqueda"))) {
    rows = await fuseSemanticMatches(rows, appliedFilters, appliedFilters.query);
  }

  const relaxedNote = relaxed?.note;
  const reply = await buildReply(rows.length, appliedFilters, message, relaxedNote, knownCityNoInventory, cities);

  return {
    reply,
    results: rows.map((r) => toChatResult(r, relaxed != null)),
    filters,
    matched: rows.length > 0 && relaxed == null,
    relaxed,
  };
}
