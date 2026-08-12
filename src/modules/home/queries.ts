import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { searchListings } from "@/modules/search/queries";
import type { PropertiesRow } from "@/modules/lib/database.types";

export type CityStat = {
  name: string;
  count: number;
};

export type HomepageStats = {
  activeCount: number;
  cities: CityStat[];
  agentCount: number;
  avgRating: number | null;
};

/**
 * Aggregate stats for the homepage trust strip and city explorer.
 * RLS restricts reads to public active rows.
 */
export async function getHomepageStats(): Promise<HomepageStats> {
  const supabase = await createSupabaseServerClient();

  const { count: activeCount } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const { data: cityRows } = await supabase
    .from("properties")
    .select("city")
    .eq("status", "active");

  const byCity = new Map<string, number>();
  for (const row of cityRows ?? []) {
    if (!row.city) continue;
    byCity.set(row.city, (byCity.get(row.city) ?? 0) + 1);
  }
  const cities = [...byCity.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const { data: agentRows } = await supabase
    .from("profiles")
    .select("rating_average")
    .eq("role", "agent")
    .not("rating_average", "is", null);

  const ratings = (agentRows ?? [])
    .map((row) => row.rating_average)
    .filter((value): value is number => value != null);

  return {
    activeCount: activeCount ?? 0,
    cities,
    agentCount: agentRows?.length ?? 0,
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
