import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { env } from "@/modules/lib/env";
import type { PropertiesRow } from "@/modules/lib/database.types";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

export function embeddingsConfigured(): boolean {
  return Boolean(env.openaiApiKey);
}

/**
 * Embed a single piece of text with OpenAI's text-embedding-3-small model.
 * Returns null when the API key is missing so callers can degrade gracefully.
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (!env.openaiApiKey) return null;
  if (!text.trim()) return null;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, 8_000) }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { embedding?: number[] }[] };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) return null;
  return embedding;
}

/**
 * Build the searchable text blob for a property row (title, description,
 * location, features). Matches what the backfill action stores.
 */
export function propertyEmbeddingText(property: PropertiesRow): string {
  const parts = [
    property.title,
    property.description ?? "",
    property.colonia ?? "",
    property.city ?? "",
    property.address ?? "",
    Array.isArray(property.amenidades) ? property.amenidades.join(", ") : "",
    Array.isArray(property.puntos_fuertes_bento)
      ? property.puntos_fuertes_bento.join(", ")
      : "",
  ];
  return parts.filter(Boolean).join(". ");
}

/**
 * Semantic search over active listings using pgvector cosine similarity.
 * Falls back to an ilike scan when embeddings are not configured or the
 * property table has no rows with vectors.
 */
export async function searchSemantic(
  query: string,
  limit = 24,
): Promise<PropertiesRow[]> {
  const supabase = await createSupabaseServerClient();

  // Graceful degradation: no API key → plain keyword search.
  if (!embeddingsConfigured()) {
    return searchKeywordFallback(query, limit);
  }

  const queryVector = await embedText(query);
  if (!queryVector) {
    return searchKeywordFallback(query, limit);
  }

  // RPC backed by the `match_properties` SQL function (cosine distance).
  const { data: rows, error } = await supabase.rpc("match_properties", {
    query_embedding: queryVector as unknown as string,
    match_count: limit,
  });

  if (error || !Array.isArray(rows) || rows.length === 0) {
    return searchKeywordFallback(query, limit);
  }

  const ids = rows
    .map((r) => (r && typeof r === "object" && "id" in r ? (r.id as string) : null))
    .filter((x): x is string => Boolean(x));

  if (ids.length === 0) {
    return searchKeywordFallback(query, limit);
  }

  const { data: props } = await supabase
    .from("properties")
    .select("*")
    .in("id", ids)
    .returns<PropertiesRow[]>();

  // Keep vector relevance ordering.
  const byId = new Map((props ?? []).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((x): x is PropertiesRow => Boolean(x));
}

async function searchKeywordFallback(query: string, limit: number): Promise<PropertiesRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("properties")
    .select("*")
    .eq("status", "active")
    .or(
      `title.ilike.%${query}%,description.ilike.%${query}%,colonia.ilike.%${query}%,city.ilike.%${query}%`,
    )
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<PropertiesRow[]>();
  return rows ?? [];
}
