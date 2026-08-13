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
 * Derive the hotness score for a property row from the cost per constructed
 * m² only. Terrenos have no constructed area, so `precio_m2_const` is null
 * and they get no m² component — ranking by terrain per-m² price would make
 * every land listing look like the best opportunity.
 */
export function toHotScore(
  discountPct: number | null,
  row: Pick<PropertiesRow, "precio_m2_const">,
): number | null {
  return computeHotScore({ discountPct, m2: row.precio_m2_const });
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
