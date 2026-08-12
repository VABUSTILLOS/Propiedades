import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import {
  getColoniaDiscount,
  toHotScore,
} from "@/modules/market-data/queries";
import type {
  PropertiesRow,
  PropertyCategory,
  PropertyDealType,
} from "@/modules/lib/database.types";

/** Max rows fetched for the in-memory "hot" sort before slicing to the limit. */
export const HOT_FETCH_CAP = 300;

export type SearchFilters = {
  query?: string;
  type?: "sale" | "rent";
  category?: PropertyCategory;
  /** Match any of these categories (e.g. local + bodega for "comercial"). */
  categories?: PropertyCategory[];
  dealType?: PropertyDealType;
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  colonia?: string;
  minM2?: number;
  maxM2?: number;
  sortBy?: "price_asc" | "price_desc" | "newest" | "score" | "hot";
  limit?: number;
  /** Only land listings: terreno_m2 > 0 and construccion_m2 = 0. */
  isLand?: boolean;
};

/** Minimal chainable interface shared by every Supabase query builder.
 * Method-syntax members use bivariant parameter checking, so the concrete
 * builder (whose filter values are typed to each column) is assignable.
 */
type FilterableQuery<Q> = {
  eq(column: string, value: unknown): Q;
  in(column: string, values: unknown[]): Q;
  gt(column: string, value: unknown): Q;
  gte(column: string, value: unknown): Q;
  lte(column: string, value: unknown): Q;
  or(query: string): Q;
};

/**
 * Applies the shared filter predicates onto a base `properties` query.
 * Extracted so searchListings and countActiveListings stay in sync.
 */
function applyFilters<Q extends FilterableQuery<Q>>(
  query: Q,
  filters: Omit<SearchFilters, "limit" | "sortBy">,
): Q {
  let q = query.eq("status", "active");

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
    q = q.gt("terreno_m2", 0).eq("construccion_m2", 0);
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
  if (filters.minM2 != null) {
    q = q.gte("construccion_m2", filters.minM2);
  }
  if (filters.maxM2 != null) {
    q = q.lte("construccion_m2", filters.maxM2);
  }
  if (filters.query) {
    q = q.or(
      `title.ilike.%${filters.query}%,description.ilike.%${filters.query}%,colonia.ilike.%${filters.query}%,city.ilike.%${filters.query}%`,
    );
  }

  return q;
}

/**
 * Full-text + structured search over active listings.
 * RLS restricts reads to public active rows; owner-only fields never leak.
 */
export async function searchListings(
  filters: SearchFilters,
): Promise<PropertiesRow[]> {
  const supabase = await createSupabaseServerClient();

  let query = applyFilters(
    supabase.from("properties").select("*"),
    filters,
  );

  switch (filters.sortBy) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "score":
      query = query.order("property_score", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data: rows } = await query
    .limit(filters.limit ?? 24)
    .returns<PropertiesRow[]>();

  return rows ?? [];
}

export type ListingWithHot = PropertiesRow & { hotScore: number | null };

/**
 * Computes the hotness score for each row (N+1 benchmark + colonia-discount
 * reads, same pattern as /investor). Sorted naturally; hotScore is attached
 * for the traffic-light gauge.
 */
export async function enrichWithHot(
  rows: PropertiesRow[],
): Promise<ListingWithHot[]> {
  const scores = await Promise.all(
    rows.map(async (row) => {
      const discountPct = await getColoniaDiscount(row.id);
      return toHotScore(discountPct, row);
    }),
  );
  return rows.map((row, i) => ({ ...row, hotScore: scores[i] ?? null }));
}

/**
 * Listing search that also carries a `hotScore` (opportunity 0–100).
 *
 * `sortBy: "hot"` is applied in memory: it fetches up to `HOT_FETCH_CAP`
 * rows (filters applied in SQL), computes the hotness score per row, sorts
 * descending (null scores last) and slices to the requested limit.
 *
 * Every other sort keeps SQL ordering and just enriches the page rows so the
 * gauge renders on each card.
 */
export async function searchListingsWithHot(
  filters: SearchFilters,
): Promise<ListingWithHot[]> {
  const supabase = await createSupabaseServerClient();

  if (filters.sortBy === "hot") {
    const base = applyFilters(supabase.from("properties").select("*"), filters);

    const { data: rows } = await base
      .order("created_at", { ascending: false })
      .limit(HOT_FETCH_CAP)
      .returns<PropertiesRow[]>();

    const enriched = await enrichWithHot(rows ?? []);
    enriched.sort((a, b) => (b.hotScore ?? -1) - (a.hotScore ?? -1));
    return enriched.slice(0, filters.limit ?? 24);
  }

  const rows = await searchListings(filters);
  return enrichWithHot(rows);
}

/**
 * Count of active listings matching the given filters.
 * Drives the per-tab count badges on the /listados portal page.
 */
export async function countActiveListings(
  filters: Omit<SearchFilters, "limit" | "sortBy">,
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const query = applyFilters(
    supabase.from("properties").select("*", { count: "exact", head: true }),
    filters,
  );

  const { count } = await query;
  return count ?? 0;
}

/**
 * Distinct cities present in active listings — drives the filter dropdown.
 */
export async function getSearchableCities(): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("properties")
    .select("city")
    .eq("status", "active")
    .returns<{ city: string }[]>();

  const cities = [...new Set((rows ?? []).map((r) => r.city).filter(Boolean))];
  return cities.sort();
}
