"use server";

import { getBenchmark, estimateValue } from "@/modules/market-data/queries";
import { ok, type ActionResult } from "@/modules/lib/action-result";

/**
 * AVM auto-valuation for the FSBO quick wizard. Looks up the colonia
 * benchmark server-side and estimates value from the entered m². Gracefully
 * returns `estimate: 0` when the colonia has no benchmark yet.
 */
export async function estimateFsboValue(
  input: Record<string, unknown>,
): Promise<
  ActionResult<{
    estimate: number;
    low: number;
    high: number;
    discountPct: number | null;
    hasBenchmark: boolean;
  }>
> {
  const city = typeof input.city === "string" ? input.city.trim() : "";
  const colonia = typeof input.colonia === "string" ? input.colonia.trim() : "";
  const construccion_m2 =
    typeof input.construccion_m2 === "number" && input.construccion_m2 > 0
      ? input.construccion_m2
      : 0;
  const terreno_m2 =
    typeof input.terreno_m2 === "number" && input.terreno_m2 > 0
      ? input.terreno_m2
      : 0;

  if (!city || !colonia || (construccion_m2 <= 0 && terreno_m2 <= 0)) {
    return ok({ estimate: 0, low: 0, high: 0, discountPct: null, hasBenchmark: false });
  }

  const benchmark = await getBenchmark(city, colonia);
  const result = estimateValue({ benchmark, construccion_m2, terreno_m2 });

  return ok({
    estimate: Math.round(result.estimate),
    low: Math.round(result.low),
    high: Math.round(result.high),
    discountPct: result.discountPct,
    hasBenchmark: Boolean(benchmark),
  });
}
