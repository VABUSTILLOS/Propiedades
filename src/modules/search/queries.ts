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
import type { MapBounds } from "@/modules/lib/schemas";

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
  /** Minimum number of bedrooms (recamaras), inclusive. */
  minBedrooms?: number;
  sortBy?:
    | "price_asc"
    | "price_desc"
    | "newest"
    | "score"
    | "hot"
    | "m2_const_asc"
    | "m2_const_desc";
  limit?: number;
  /** Only land listings: terreno_m2 > 0 and construccion_m2 = 0. */
  isLand?: boolean;
  /** Restrict to a map viewport. Rows without coordinates are excluded. */
  bounds?: MapBounds;
  /** Row offset for paginated fetches (infinite scroll). */
  offset?: number;
};

/** Lightweight pin payload for the interactive city map. */
export type PropertyMapMarker = {
  id: string;
  title: string;
  slug: string;
  city: string | null;
  colonia: string | null;
  price: number;
  currency: string;
  type: "sale" | "rent";
  images: string[] | null;
  lat: number;
  lng: number;
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

/** Escape LIKE wildcards so user keywords are matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Apply simple Spanish accent-fold to a single character. */
function foldAccent(ch: string): string {
  switch (ch) {
    case "á": case "Á": return "a";
    case "é": case "É": return "e";
    case "í": case "Í": return "i";
    case "ó": case "Ó": return "o";
    case "ú": case "Ú": return "u";
    case "ü": case "Ü": return "u";
    case "ñ": case "Ñ": return "n";
    default: return ch;
  }
}

/** Build the plural of a Spanish keyword (best-effort, covers our nouns). */
function pluralize(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith("es") || lower.endsWith("s")) return word;
  if (/(z)$/.test(lower)) return word.slice(0, -1) + "ces";
  return word + "s";
}

/** Build the singular stem of a Spanish keyword (reverse of pluralize). */
function singularize(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith("ces")) return lower.slice(0, -3) + "z";
  if (lower.endsWith("es")) return lower.slice(0, -2);
  if (lower.endsWith("s")) return lower.slice(0, -1);
  return lower;
}

/**
 * Keyword variants to search: the stem itself, its plural, and the same forms
 * with accents folded both ways. Titles mix spellings ("2 recamaras" vs
 * "2 recámaras"), so a single ilike can miss rows that a sibling matches.
 */
function keywordVariants(query: string): string[] {
  const singular = singularize(query.toLowerCase());
  const plural = pluralize(singular);
  const variants = new Set<string>([singular, plural, query.toLowerCase()]);
  for (const v of [singular, plural]) {
    const folded = v.replace(/[áéíóúüñÁÉÍÓÚÜÑ]/g, foldAccent);
    if (folded !== v) variants.add(folded);
  }
  return [...variants];
}

/** OR-ed ilike predicate over the searchable columns, one per variant. */
function buildQueryOrClause(query: string): string {
  // Text columns searched directly. Note: PostgREST logic trees do NOT
  // support `::text` casts (PGRST100 parse error), so the JSONB feature
  // arrays (amenidades, puntos_fuertes_bento) cannot be OR-ed in here.
  // Those arrays are populated by semantic embeddings (GEMINI_API_KEY) and
  // matched via the `query` semantic path, not this ILIKE fallback.
  const columns = [
    "title",
    "description",
    "colonia",
    "city",
    "address",
  ];
  const parts: string[] = [];
  for (const column of columns) {
    for (const variant of keywordVariants(query)) {
      parts.push(`${column}.ilike.%${escapeLike(variant)}%`);
      if (parts.length >= 56) break;
    }
    if (parts.length >= 56) break;
  }
  return parts.join(",");
}

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
    // "Terrenos" are identified by category, not by the m² columns: the scraper
    // fills terreno_m2 and construccion_m2 with the same value, so the old
    // terreno_m2>0 AND construccion_m2=0 test could never match anything.
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
  const m2Column = filters.isLand || filters.category === "terreno" ? "terreno_m2" : "construccion_m2";
  if (filters.minM2 != null) {
    q = q.gte(m2Column, filters.minM2);
  }
  if (filters.maxM2 != null) {
    q = q.lte(m2Column, filters.maxM2);
  }
  if (filters.minBedrooms != null) {
    q = q.gte("recamaras", filters.minBedrooms);
  }
  if (filters.query) {
    q = q.or(buildQueryOrClause(filters.query));
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
 * Full-text + structured search over active listings.
 * RLS restricts reads to public active rows; owner-only fields never leak.
 */
export async function searchListings(
  filters: SearchFilters,
): Promise<PropertiesRow[]> {
  const { rows } = await selectListingsPage(filters);
  return rows;
}

/** Page select with exact count, honoring bounds + `offset`/`range`. */
async function selectListingsPage(filters: SearchFilters): Promise<{
  rows: PropertiesRow[];
  total: number;
}> {
  const supabase = await createSupabaseServerClient();

  let query = applyFilters(
    supabase.from("properties").select("*", { count: "exact" }),
    filters,
  );

  switch (filters.sortBy) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "m2_const_asc":
      // Cost per constructed m² (`precio_m2_const` is a generated column).
      // Rows without construction area (null) always go last.
      query = query.order("precio_m2_const", {
        ascending: true,
        nullsFirst: false,
      });
      break;
    case "m2_const_desc":
      query = query.order("precio_m2_const", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "score":
      query = query.order("property_score", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 24;
  const { data: rows, count } = await query
    .range(offset, offset + limit - 1)
    .returns<PropertiesRow[]>();

  return { rows: rows ?? [], total: count ?? 0 };
}

export type ListingWithHot = PropertiesRow & {
  hotScore: number | null;
  /** Percent below (positive) or above (negative) the colonia benchmark. */
  discountPct: number | null;
};

/**
 * Computes the hotness score for each row (N+1 benchmark + colonia-discount
 * reads, same pattern as /investor). Sorted naturally; hotScore is attached
 * for the traffic-light gauge and discountPct for the cards' optional
 * "% descuento vs colonia" detail.
 */
export async function enrichWithHot(
  rows: PropertiesRow[],
): Promise<ListingWithHot[]> {
  const meta = await Promise.all(
    rows.map(async (row) => {
      const discountPct = await getColoniaDiscount(row.id);
      return { hotScore: toHotScore(discountPct, row), discountPct };
    }),
  );
  return rows.map((row, i) => ({
    ...row,
    hotScore: meta[i]?.hotScore ?? null,
    discountPct: meta[i]?.discountPct ?? null,
  }));
}

/**
 * Paginated listing search that also carries a `hotScore` (opportunity 0–100)
 * and the exact match count. This is the endpoint backing both the page
 * render and `GET /api/search` for infinite scroll.
 *
 * `sortBy: "hot"` is applied in memory: it fetches up to `HOT_FETCH_CAP`
 * rows (filters applied in SQL), computes the hotness score per row, sorts
 * descending (null scores last) and slices to the requested page window.
 *
 * Every other sort keeps SQL ordering and just enriches the page rows so the
 * gauge renders on each card.
 */
export async function searchListingsPage(filters: SearchFilters): Promise<{
  items: ListingWithHot[];
  total: number;
}> {
  if (filters.sortBy === "hot") {
    const supabase = await createSupabaseServerClient();

    const base = applyFilters(
      supabase.from("properties").select("*", { count: "exact" }),
      filters,
    );

    const { data: rows, count } = await base
      .order("created_at", { ascending: false })
      .limit(HOT_FETCH_CAP)
      .returns<PropertiesRow[]>();

    const enriched = await enrichWithHot(rows ?? []);
    enriched.sort((a, b) => (b.hotScore ?? -1) - (a.hotScore ?? -1));

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 24;
    return {
      items: enriched.slice(offset, offset + limit),
      total: count ?? 0,
    };
  }

  const { rows, total } = await selectListingsPage(filters);
  return { items: await enrichWithHot(rows), total };
}

/**
 * Listing search that also carries a `hotScore` (opportunity 0–100).
 * Thin wrapper over `searchListingsPage` for the first page.
 */
export async function searchListingsWithHot(
  filters: SearchFilters,
): Promise<ListingWithHot[]> {
  const { items } = await searchListingsPage(filters);
  return items;
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

/**
 * Distinct colonias present in active listings — drives the filter dropdown.
 * Optionally scoped to a deal type (`sale`/`rent`) for category-specific pages.
 */
export async function getSearchableColonias(
  type?: "sale" | "rent",
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("properties")
    .select("colonia")
    .eq("status", "active");
  if (type) {
    query = query.eq("type", type);
  }

  const { data: rows } = await query.returns<{ colonia: string }[]>();

  const colonias = [...new Set((rows ?? []).map((r) => r.colonia).filter(Boolean))];
  return colonias.sort();
}

/**
 * Lightweight pins for the city map: only the columns the markers need, all
 * matching filters applied (bounds included). Capped at 500 so a wide viewport
 * over a large catalog stays fast.
 */
export async function getListingMarkers(
  filters: Omit<SearchFilters, "limit" | "sortBy">,
): Promise<PropertyMapMarker[]> {
  const supabase = await createSupabaseServerClient();

  const query = applyFilters(
    supabase
      .from("properties")
      .select("id,title,slug,city,colonia,price,currency,type,images,lat,lng"),
    filters,
  );

  const { data: rows } = await query
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<
      Array<
        Omit<PropertyMapMarker, "lat" | "lng"> & { lat: number | null; lng: number | null }
      >
    >();

  return (rows ?? [])
    .filter(
      (r) =>
        r.lat != null &&
        r.lng != null &&
        // (0,0) is the placeholder for rows that were never geocoded — keep
        // them out of the map so pins don't pile up in the ocean.
        (r.lat !== 0 || r.lng !== 0),
    )
    .map((r) => ({ ...r, lat: r.lat as number, lng: r.lng as number }));
}
