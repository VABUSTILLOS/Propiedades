import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { SearchFilters } from "@/modules/search/queries";

type CountFilters = Omit<SearchFilters, "limit" | "sortBy" | "query">;

/** Minimal chainable interface shared by every Supabase count query. */
type CountableQuery<Q> = {
  eq(column: string, value: unknown): Q;
  in(column: string, values: unknown[]): Q;
  gt(column: string, value: unknown): Q;
  gte(column: string, value: unknown): Q;
  lte(column: string, value: unknown): Q;
};

/**
 * Same structured predicates as `applyFilters` in search/queries.ts, minus the
 * keyword query. The photo rule is included so the cintillo badges match what
 * the listing grid actually shows: every tab counts only active listings with
 * more than one photo (`image_count > 1`).
 */
function applyCountFilters<Q extends CountableQuery<Q>>(
  query: Q,
  filters: CountFilters,
): Q {
  let q = query.eq("status", "active");

  // Same public-catalog photo rule as the listing grid ("varias fotos"):
  // only show/count listings with 2+ photos.
  q = q.gt("image_count", 1);

  if (filters.type) {
    q = q.eq("type", filters.type);
  }
  if (filters.category) {
    q = q.eq("category", filters.category);
  }
  if (filters.categories?.length) {
    q = q.in("category", filters.categories);
  }
  if (filters.dealType) {
    q = q.eq("deal_type", filters.dealType);
  }
  if (filters.isLand) {
    // Terrenos are identified by category, not by the m² columns.
    q = q.eq("category", "terreno");
  }
  if (filters.city) {
    q = q.eq("city", filters.city);
  }
  if (filters.colonia) {
    q = q.eq("colonia", filters.colonia);
  }
  if (filters.minPrice != null) {
    q = q.gte("price", filters.minPrice);
  }
  if (filters.maxPrice != null) {
    q = q.lte("price", filters.maxPrice);
  }
  // Land listings report size via terreno_m2; buildings via construccion_m2.
  const m2Column =
    filters.isLand || filters.category === "terreno"
      ? "terreno_m2"
      : "construccion_m2";
  if (filters.minM2 != null) {
    q = q.gte(m2Column, filters.minM2);
  }
  if (filters.maxM2 != null) {
    q = q.lte(m2Column, filters.maxM2);
  }
  if (filters.minBedrooms != null) {
    q = q.gte("recamaras", filters.minBedrooms);
  }
  if (filters.bounds) {
    q = q
      .gte("lat", filters.bounds.minLat)
      .lte("lat", filters.bounds.maxLat)
      .gte("lng", filters.bounds.minLng)
      .lte("lng", filters.bounds.maxLng);
  }

  return q;
}

/**
 * Count of active listings matching the given filters, including the
 * public-catalog photo rule (`image_count > 1`). Drives the cintillo count
 * badges on /search so they show exactly what the listing grid shows per tab.
 */
export async function countActiveTab(filters: CountFilters): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const query = applyCountFilters(
    supabase.from("properties").select("*", { count: "exact", head: true }),
    filters,
  );

  const { count } = await query;
  return count ?? 0;
}
