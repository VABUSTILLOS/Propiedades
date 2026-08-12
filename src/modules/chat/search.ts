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
  return `Encontré ${ctx.count} ${noun}${where}${budget}${keyword}.`;
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
): Promise<string> {
  const result = await chatCompletion({
    temperature: 0.5,
    maxTokens: 120,
    system:
      "You are a friendly Mexican real-estate assistant. Reply in Spanish, 1–2 short sentences, " +
      "no markdown, no emoji. State how many listings you found and the filters applied. " +
      "If none were found, suggest adjusting price or location.",
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

  const rows = await searchListings({
    ...filters,
    limit: CHAT_RESULT_LIMIT,
    sortBy: "newest",
  });

  const reply = await buildReply(rows.length, filters, message);

  return {
    reply,
    results: rows.map(toChatResult),
    filters,
  };
}
