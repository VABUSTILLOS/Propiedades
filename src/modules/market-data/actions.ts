"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { marketBenchmarkSchema } from "@/modules/lib/schemas";

/**
 * Upsert a market benchmark. Admin-only (server-enforced; RLS backstop).
 */
export async function upsertBenchmark(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  await requireRole(["admin"]);
  const parsed = parseInput(marketBenchmarkSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("market_benchmarks")
    .upsert(
      {
        city: parsed.data.city,
        colonia: parsed.data.colonia,
        avg_price_m2_const: parsed.data.avg_price_m2_const,
        avg_price_m2_land: parsed.data.avg_price_m2_land,
        historical_growth_rate: parsed.data.historical_growth_rate,
      },
      { onConflict: "city,colonia" },
    )
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/search");
  return ok({ id: data.id });
}
