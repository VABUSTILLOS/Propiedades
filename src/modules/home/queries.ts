import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import {
  enrichWithHot,
  getActiveCityStats,
  searchListings,
  type CityStat,
  type ListingWithHot,
} from "@/modules/search/queries";
import type { PropertiesRow } from "@/modules/lib/database.types";

export type { CityStat };

export type HomepageStats = {
  activeCount: number;
  cities: CityStat[];
  agentCount: number;
  avgRating: number | null;
};

/**
 * Aggregate stats for the homepage trust strip and city explorer.
 * RLS restricts reads to public active rows.
 *
 * The per-city distribution and the total active count come from a single
 * grouped `list_active_cities` RPC (previously a full `city` column scan plus
 * a separate exact head-count), and the agents query runs in parallel.
 */
export async function getHomepageStats(): Promise<HomepageStats> {
  const supabase = await createSupabaseServerClient();

  const [cityStats, agentResult] = await Promise.all([
    getActiveCityStats(),
    supabase
      .from("profiles")
      .select("rating_average")
      .eq("role", "agent")
      .not("rating_average", "is", null),
  ]);

  const activeCount = cityStats.reduce((sum, city) => sum + city.count, 0);
  const cities = [...cityStats].sort((a, b) => b.count - a.count);

  const agentRows = agentResult.data ?? [];
  const ratings = agentRows
    .map((row) => row.rating_average)
    .filter((value): value is number => value != null);

  return {
    activeCount,
    cities,
    agentCount: agentRows.length,
    avgRating:
      ratings.length > 0
        ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
        : null,
  };
}

/**
 * Newest active listings for the "Propiedades destacadas" grid.
 */
export async function getFeaturedListings(limit = 6): Promise<PropertiesRow[]> {
  return searchListings({ limit, sortBy: "newest" });
}

/**
 * Top-rated active listings by AI score for the "Mejor calificadas" grid.
 */
export async function getTopRatedListings(limit = 6): Promise<PropertiesRow[]> {
  return searchListings({ limit, sortBy: "score" });
}

/**
 * Top opportunities for the homepage ranking: candidates pre-filtered by
 * trust score, enriched with the colonia discount + hot score, then ordered
 * by hotness. Caps the benchmark RPC fan-out to the candidate pool (24 rows)
 * instead of the full HOT_FETCH_CAP scan the /search hot sort performs.
 */
export async function getTopOpportunities(
  limit = 8,
): Promise<ListingWithHot[]> {
  const candidates = await searchListings({ sortBy: "score", limit: 24 });
  const enriched = await enrichWithHot(candidates);
  enriched.sort((a, b) => (b.hotScore ?? -1) - (a.hotScore ?? -1));
  return enriched.slice(0, limit);
}

/**
 * Active listings published in the last 7 days — feeds the "nuevas esta
 * semana" pulse stat and the hero status pill.
 */
export async function getNewThisWeekCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .gt("image_count", 1)
    .gte("created_at", since);

  return count ?? 0;
}

/**
 * Newest active listings in a given city — drives the city-tabbed
 * featured grid (Bali Listings pattern, adapted to Mexican cities).
 */
export async function getFeaturedListingsByCity(
  city: string,
  limit = 6,
): Promise<PropertiesRow[]> {
  return searchListings({ city, limit, sortBy: "newest" });
}

/**
 * Ids of the properties the current user has saved as favorites.
 * Returns an empty set for anonymous visitors.
 */
export async function getSavedPropertyIds(
  userId: string | null,
): Promise<Set<string>> {
  if (!userId) return new Set();

  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("buyer_favorites")
    .select("property_id")
    .eq("user_id", userId)
    .returns<{ property_id: string }[]>();

  return new Set((rows ?? []).map((row) => row.property_id));
}
