import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { env } from "@/modules/lib/env";
import type { PropertiesRow } from "@/modules/lib/database.types";

/**
 * Free embeddings provider for semantic search.
 *
 * Uses Google Gemini `gemini-embedding-001` via a free Google AI Studio key
 * (`GEMINI_API_KEY`, https://aistudio.google.com/apikey). The model returns
 * 768-dimension vectors (via `outputDimensionality`), matching the
 * column/index/migration (019) and the `match_properties` RPC.
 *
 * Every function returns null / false when the key is unset or the request
 * fails, so callers degrade gracefully to keyword search — the same
 * graceful-degradation pattern used across the repo.
 */

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

export function embeddingsConfigured(): boolean {
  return Boolean(env.geminiApiKey);
}

/**
 * Embed a single piece of text with Google Gemini's free text-embedding-004
 * model (768 dimensions). Returns null when the API key is missing, the
 * request fails, or the response is malformed.
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (!env.geminiApiKey) return null;
  if (!text.trim()) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.geminiApiKey,
        },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text: text.slice(0, 8_000) }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        }),
      },
    );

    if (!res.ok) return null;
    const data = (await res.json()) as {
      embedding?: { values?: number[] };
    };
    const embedding = data.embedding?.values;
    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) return null;
    return embedding;
  } catch {
    return null;
  }
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
