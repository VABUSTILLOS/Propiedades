"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/modules/lib/action-result";
import { generateDescription, scoreProperty } from "@/modules/ai/server";
import type { PropertiesRow } from "@/modules/lib/database.types";

/**
 * Generate a description draft from structured wizard data.
 * Works before the draft row exists. Falls back gracefully when no
 * DeepSeek key is configured.
 */
export async function generateDescriptionDraft(input: {
  title: string;
  type: "sale" | "rent";
  city: string;
  colonia: string;
  terrainM2: string;
  constructionM2: string;
  price: string;
}): Promise<ActionResult<{ description: string }>> {
  await requireUserOrThrow();

  const description = await generateDescription({
    title: input.title,
    type: input.type,
    city: input.city,
    colonia: input.colonia,
    terrainM2: Number(input.terrainM2) || 0,
    constructionM2: Number(input.constructionM2) || 0,
    price: Number(input.price) || 0,
  });

  if (!description) {
    return fail(
      "AI description unavailable — add your DEEPSEEK_API_KEY to generate copy.",
    );
  }

  return ok({ description });
}

/**
 * Compute and persist an AI investment score for a listing the caller owns.
 */
export async function scoreListing(
  listingId: string,
): Promise<ActionResult<{ score: number; reasoning: string }>> {
  const user = await requireUserOrThrow();
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("properties")
    .select("*")
    .eq("id", listingId)
    .eq("owner_id", user.id)
    .returns<PropertiesRow[]>()
    .limit(1);

  const listing = rows?.[0];
  if (!listing) {
    return fail("Listing not found.");
  }

  const result = await scoreProperty({
    title: listing.title,
    city: listing.city,
    colonia: listing.colonia,
    price: listing.price,
    terrainM2: listing.terreno_m2,
    constructionM2: listing.construccion_m2,
    estimatedMonthlyRent: listing.estimated_monthly_rent,
  });

  if (!result) {
    return fail(
      "AI scoring unavailable — add your DEEPSEEK_API_KEY to score listings.",
    );
  }

  const { error } = await supabase
    .from("properties")
    .update({ property_score: result.score })
    .eq("id", listing.id);

  if (error) {
    return fail(error.message);
  }

  revalidatePath(`/property/${listing.slug}`);
  return ok(result);
}
