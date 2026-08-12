import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type {
  PropertiesRow,
  PropertyCategory,
  PropertyDealType,
} from "@/modules/lib/database.types";

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
  sortBy?: "price_asc" | "price_desc" | "newest" | "score";
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
