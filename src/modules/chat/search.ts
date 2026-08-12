import "server-only";

import { chatCompletion } from "@/modules/ai/server";
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
    return `No encontré ${what}${where}${budget}${keyword}. Prueba ajustar el precio o la ubicación.`;
  }
  const noun = ctx.count === 1 ? "resultado" : "resultados";
  const note = ctx.relaxedNote ? ` ${ctx.relaxedNote}` : "";
  return `Encontré ${ctx.count} ${noun}${where}${budget}${keyword}.${note}`;
}

function toChatResult(row: PropertiesRow): ChatResult {
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
    construccion_m2: row.construccion_m2,
    terreno_m2: row.terreno_m2,
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

/** Run the full search pipeline for a chat message. */
export async function runChatSearch(
  message: string,
  cities: string[],
  previousFilters?: ChatFilters,
): Promise<ChatResponse> {
  const extracted = await interpretMessage(message, cities);
  const filters = mergeFilters(previousFilters, extracted);

  const search = (f: ChatFilters) =>
    searchListings({
      ...f,
      limit: CHAT_RESULT_LIMIT,
      sortBy: "newest",
    });

  let rows = await search(filters);

  // Zero-result relaxation: drop the least specific filters one at a time so a
  // too-narrow keyword or city still surfaces *something* instead of an empty
  // answer. The note tells the user what was relaxed.
  let relaxedNote: string | undefined;
  if (rows.length === 0) {
    const relaxed = { ...filters };
    if (relaxed.query != null) {
      delete relaxed.query;
      rows = await search(relaxed);
      if (rows.length > 0) {
        relaxedNote = `Mostrando resultados sin filtro de búsqueda ("${filters.query}").`;
      }
    }
  }
  if (rows.length === 0 && filters.city != null) {
    const relaxed = { ...filters };
    delete relaxed.city;
    rows = await search(relaxed);
    if (rows.length > 0) {
      relaxedNote = `Mostrando resultados sin filtro de ciudad.`;
    }
  }
  if (rows.length === 0 && (filters.minPrice != null || filters.maxPrice != null)) {
    const relaxed = { ...filters };
    delete relaxed.minPrice;
    delete relaxed.maxPrice;
    rows = await search(relaxed);
    if (rows.length > 0) {
      relaxedNote = `Mostrando resultados sin filtro de precio.`;
    }
  }

  const reply = await buildReply(rows.length, filters, message, relaxedNote);

  return {
    reply,
    results: rows.map(toChatResult),
    filters,
  };
}
