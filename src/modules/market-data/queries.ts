import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type {
  MarketBenchmarksRow,
  PropertiesRow,
} from "@/modules/lib/database.types";

/**
 * Reference price per m² (MXN) above which a property is considered "not
 * cheap" and stops earning m² component points. Tunable.
 */
export const HOT_M2_REF = 50_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Composite opportunity score 0–100 (balanced 50/50):
 *  - discountPct: % savings vs the colonia benchmark (higher = hotter).
 *  - m2: cost per constructed m² (cheaper = hotter), normalized against
 *    `HOT_M2_REF`.
 * Returns null when neither input is available. When only one input is
 * available it counts with full weight.
 */
export function computeHotScore(input: {
  discountPct: number | null;
  m2: number | null;
}): number | null {
  const { discountPct, m2 } = input;

  const discountComponent =
    discountPct == null ? null : clamp(discountPct, 0, 100);

  const m2Component =
    m2 == null || m2 <= 0
      ? null
      : clamp((100 * (HOT_M2_REF - m2)) / HOT_M2_REF, 0, 100);

  if (discountComponent == null && m2Component == null) return null;
  if (discountComponent == null) return Math.round(m2Component!);
  if (m2Component == null) return Math.round(discountComponent);

  return Math.round(0.5 * discountComponent + 0.5 * m2Component);
}

/**
 * % below (positive) or above (negative) the colonia land benchmark for a
 * property's price per land m² — the land counterpart of the construction
 * discount from `compute_colonia_discount`. Null when either side is
 * missing or non-positive.
 */
export function computeLandDiscountPct(
  benchmark: Pick<MarketBenchmarksRow, "avg_price_m2_land"> | null,
  precioM2Terreno: number | null,
): number | null {
  if (!benchmark || benchmark.avg_price_m2_land <= 0) return null;
  if (precioM2Terreno == null || precioM2Terreno <= 0) return null;
  return (
    ((benchmark.avg_price_m2_land - precioM2Terreno) /
      benchmark.avg_price_m2_land) *
    100
  );
}

/**
 * Land discounts for a whole row set in one benchmarks query (the batch
 * RPC only covers the construction discount). Returns a property id →
 * land discount map; ids with no usable benchmark or land price are
 * absent (callers resolve them to null).
 */
export async function getLandDiscounts(
  rows: Array<{
    id: string;
    city: string | null;
    colonia: string | null;
    precio_m2_terreno: number | null;
  }>,
): Promise<Map<string, number>> {
  const discounts = new Map<string, number>();
  const candidates = rows.filter(
    (r) =>
      r.precio_m2_terreno != null &&
      r.precio_m2_terreno > 0 &&
      r.city &&
      r.colonia,
  );
  if (candidates.length === 0) return discounts;

  const supabase = await createSupabaseServerClient();
  const colonias = [
    ...new Set(
      candidates
        .map((r) => r.colonia)
        .filter((c): c is string => Boolean(c)),
    ),
  ];
  const { data } = await supabase
    .from("market_benchmarks")
    .select("city,colonia,avg_price_m2_land")
    .in("colonia", colonias)
    .returns<
      Pick<MarketBenchmarksRow, "city" | "colonia" | "avg_price_m2_land">[]
    >();

  const byPair = new Map(
    (data ?? []).map((b) => [`${b.city}|${b.colonia}`, b]),
  );
  for (const row of candidates) {
    const pct = computeLandDiscountPct(
      byPair.get(`${row.city}|${row.colonia}`) ?? null,
      row.precio_m2_terreno,
    );
    if (pct != null) discounts.set(row.id, pct);
  }
  return discounts;
}

/**
 * Derive the hotness score for a property row. Construction-based signals
 * (discount vs the colonia construction benchmark + cost per constructed
 * m²) are primary. When a property has no constructed area on record, its
 * land discount (price per land m² vs the colonia land benchmark) stands
 * in as the discount component. Terrenos are scored on that land discount
 * alone — they have no construction to rank, and comparing them on land
 * price against their own colonia keeps them from dominating the bar.
 */
export function toHotScore(
  discountPct: number | null,
  row: Pick<PropertiesRow, "category" | "precio_m2_const">,
  landDiscountPct: number | null = null,
): number | null {
  if (row.category === "terreno") {
    return computeHotScore({ discountPct: landDiscountPct, m2: null });
  }
  return computeHotScore({
    discountPct: discountPct ?? landDiscountPct,
    m2: row.precio_m2_const,
  });
}

/**
 * Market benchmark for a city + colonia (public read — RLS allows SELECT).
 */
export async function getBenchmark(
  city: string,
  colonia: string,
): Promise<MarketBenchmarksRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("market_benchmarks")
    .select("*")
    .eq("city", city)
    .eq("colonia", colonia)
    .returns<MarketBenchmarksRow[]>()
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Benchmarks for a whole city (for AVM / comps view).
 */
export async function getCityBenchmarks(
  city: string,
): Promise<MarketBenchmarksRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("market_benchmarks")
    .select("*")
    .eq("city", city)
    .order("colonia", { ascending: true })
    .returns<MarketBenchmarksRow[]>();

  return rows ?? [];
}

/**
 * Compute the property's % discount vs the colonia benchmark via the
 * `compute_colonia_discount` Postgres function. Returns null when there is
 * no benchmark or the RPC is unavailable.
 */
export async function getColoniaDiscount(
  propertyId: string,
): Promise<number | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("compute_colonia_discount", {
    target_property_id: propertyId,
  });

  if (error) return null;
  return typeof data === "number" ? data : null;
}

/**
 * Compute colonia discounts for a whole row set with a single set-based RPC
 * (`compute_colonia_discounts`) instead of one round-trip per property —
 * search/hot paths enrich up to 300 rows per request. Returns a
 * property id → discount map; ids absent from the map resolve to null
 * (same semantics as `getColoniaDiscount`).
 *
 * Falls back to the per-row RPCs when the batch function is not deployed yet.
 */
export async function getColoniaDiscounts(
  propertyIds: string[],
): Promise<Map<string, number>> {
  const discounts = new Map<string, number>();
  if (propertyIds.length === 0) return discounts;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("compute_colonia_discounts", { p_ids: propertyIds })
    .returns<{ property_id: string; discount_pct: number }[]>();

  if (!error && Array.isArray(data)) {
    for (const row of data) {
      if (row?.property_id != null && typeof row.discount_pct === "number") {
        discounts.set(row.property_id, row.discount_pct);
      }
    }
    return discounts;
  }

  // Migration not deployed yet — fall back to one RPC per property.
  const results = await Promise.all(
    propertyIds.map(
      async (id): Promise<[string, number | null]> => [id, await getColoniaDiscount(id)],
    ),
  );
  for (const [id, pct] of results) {
    if (pct != null) discounts.set(id, pct);
  }
  return discounts;
}

/**
 * Estimate property value (AVM) from benchmark $/m² against the listing area.
 * Falls back gracefully when no benchmark exists.
 */
export function estimateValue(input: {
  benchmark?: MarketBenchmarksRow | null;
  construccion_m2: number;
  terreno_m2: number;
}): { estimate: number; discountPct: number | null; low: number; high: number } {
  const { benchmark, construccion_m2, terreno_m2 } = input;

  if (!benchmark) {
    return { estimate: 0, discountPct: null, low: 0, high: 0 };
  }

  const estimate =
    benchmark.avg_price_m2_const * construccion_m2 +
    benchmark.avg_price_m2_land * terreno_m2;

  // ±10% confidence band.
  return {
    estimate,
    discountPct: null,
    low: estimate * 0.9,
    high: estimate * 1.1,
  };
}
