import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { MarketBenchmarksRow } from "@/modules/lib/database.types";

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
