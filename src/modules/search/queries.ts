import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { PropertiesRow } from "@/modules/lib/database.types";

export type SearchFilters = {
  query?: string;
  type?: "sale" | "rent";
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  colonia?: string;
  minM2?: number;
  maxM2?: number;
  sortBy?: "price_asc" | "price_desc" | "newest" | "score";
  limit?: number;
};

/**
 * Full-text + structured search over active listings.
 * RLS restricts reads to public active rows; owner-only fields never leak.
 */
export async function searchListings(
  filters: SearchFilters,
): Promise<PropertiesRow[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("properties").select("*").eq("status", "active");

  if (filters.type) {
    query = query.eq("type", filters.type);
  }
  if (filters.city) {
    query = query.eq("city", filters.city);
  }
  if (filters.colonia) {
    query = query.eq("colonia", filters.colonia);
  }
  if (filters.minPrice != null) {
    query = query.gte("price", filters.minPrice);
  }
  if (filters.maxPrice != null) {
    query = query.lte("price", filters.maxPrice);
  }
  if (filters.minM2 != null) {
    query = query.gte("construccion_m2", filters.minM2);
  }
  if (filters.maxM2 != null) {
    query = query.lte("construccion_m2", filters.maxM2);
  }
  if (filters.query) {
    query = query.or(
      `title.ilike.%${filters.query}%,description.ilike.%${filters.query}%,colonia.ilike.%${filters.query}%,city.ilike.%${filters.query}%`,
    );
  }

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
