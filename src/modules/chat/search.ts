import "server-only";

import { chatCompletion } from "@/modules/ai/server";
import { embeddingsConfigured, searchSemantic } from "@/modules/ai/embeddings";
import { extractFilters } from "@/modules/chat/extract";
import { interpretQuery } from "@/modules/chat/interpret";
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
  /** Human-readable note appended when some filters were dropped to find results. */
  relaxedNote?: string;
};

function buildTemplateReply(ctx: TemplateContext): string {
  const what = ctx.type === "rent" ? "rentas" : ctx.type === "sale" ? "propiedades en venta" : "propiedades";
  const where = ctx.city ? ` en ${ctx.city}` : "";
  const budget = ctx.maxPrice != null ? ` por menos de $${ctx.maxPrice.toLocaleString("es-MX")} MXN` : "";
  const keyword = ctx.query ? ` que coincidan con "${ctx.query}"` : "";

  if (ctx.count === 0) {
    return `No encontré ${what}${where}${budget}${keyword}. Prueba ajustar el precio o la ubicación, o pide "ver alternativas".`;
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
    return llmFilters;
  }
  return interpretQuery(message, cities);
}

/** Merge new filters over the previous turn, keeping earlier context. */
export function mergeFilters(previous: ChatFilters | undefined, next: ChatFilters): ChatFilters {
  return { ...previous, ...next };
}

/** Natural-language reply. Prefers the LLM; falls back to a clean template. */
async function buildReply(
  count: number,
  filters: ChatFilters,
  userMessage: string,
  relaxedNote?: string,
): Promise<string> {
  const result = await chatCompletion({
    temperature: 0.5,
    maxTokens: 120,
    system:
      "You are a friendly Mexican real-estate assistant. Reply in Spanish, 1–2 short sentences, " +
      "no markdown, no emoji. State how many listings you found and the filters applied. " +
      "If none were found, suggest adjusting price or location. " +
      (relaxedNote ? `Note: ${relaxedNote}` : ""),
    user:
      `User said: "${userMessage}"\n` +
      `Filters applied: ${JSON.stringify(filters)}\n` +
      `Listings found: ${count}`,
  });

  const content = result?.content?.trim();
  if (content && content.length <= 300) return content;
  return buildTemplateReply({
    count,
    type: filters.type,
    city: filters.city,
    maxPrice: filters.maxPrice,
    query: filters.query,
    relaxedNote,
  });
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
export async function runChatSearch(
  message: string,
  cities: string[],
  previousFilters?: ChatFilters,
  options: { mode?: "strict" | "alternatives" } = {},
): Promise<ChatResponse> {
  const mode = options.mode ?? "strict";
  const extracted = await interpretMessage(message, cities);
  const filters = mergeFilters(previousFilters, extracted);

  const search = (f: ChatFilters) =>
    searchListings({
      ...f,
      limit: CHAT_RESULT_LIMIT,
      sortBy: "newest",
    });

  let rows = await search(filters);
  let relaxed: ChatResponse["relaxed"];

  // In strict mode we never relax filters silently: an empty result is an
  // honest answer, not a licence to show unrelated properties.
  if (rows.length === 0 && mode === "alternatives") {
    // Drop the least specific filters one at a time so a too-narrow keyword
    // or city still surfaces *something* — but every result is labelled so
    // the user knows what was relaxed. type is deliberately excluded.
    const relaxedFilters = { ...filters };
    const dropSteps: Array<{ name: string; drop: (f: ChatFilters) => void }> = [
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
      relaxed = {
        dropped,
        note: `Mostrando alternativas sin filtro de ${dropped.join(" y ")}.`,
      };
    }
  }

  // Semantic fusion: when the user typed a keyword and Gemini embeddings are
  // configured, rank the query vector against all active listings and fill
  // the remaining slots with matches that also pass the structured filters.
  // Without a GEMINI_API_KEY this is a no-op and the pipeline stays keyword-only.
  if (filters.query) {
    rows = await fuseSemanticMatches(rows, filters, filters.query);
  }

  const relaxedNote = relaxed?.note;
  const reply = await buildReply(rows.length, filters, message, relaxedNote);

  return {
    reply,
    results: rows.map((r) => toChatResult(r, relaxed != null)),
    filters,
    matched: rows.length > 0 && relaxed == null,
    relaxed,
  };
}
