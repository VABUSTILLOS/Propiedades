"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { favoriteReorderSchema, favoriteUpsertSchema } from "@/modules/lib/schemas";

/**
 * Add or update a favorite (tier_rank + private notes). Idempotent upsert
 * scoped to the calling user — RLS prevents touching others' rows.
 */
export async function upsertFavorite(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(favoriteUpsertSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("buyer_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("property_id", parsed.data.propertyId)
    .limit(1);

  const favoriteId = existing?.[0]?.id;

  if (favoriteId) {
    const { error } = await supabase
      .from("buyer_favorites")
      .update({
        tier_rank: parsed.data.tierRank,
        private_notes: parsed.data.privateNotes ?? null,
      })
      .eq("id", favoriteId);
    if (error) {
      return fail(error.message);
    }
  } else {
    const { data, error } = await supabase
      .from("buyer_favorites")
      .insert({
        user_id: user.id,
        property_id: parsed.data.propertyId,
        tier_rank: parsed.data.tierRank,
        private_notes: parsed.data.privateNotes ?? null,
      })
      .select("id")
      .single();
    if (error) {
      return fail(error.message);
    }
    return ok({ id: data.id });
  }

  revalidatePath("/favorites");
  return ok({ id: favoriteId });
}

/**
 * Persist a new drag-and-drop ranking. The array must contain every
 * favorite id (front-end sends the full order).
 */
export async function reorderFavorites(
  input: Record<string, unknown>,
): Promise<ActionResult<undefined>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(favoriteReorderSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: mine } = await supabase
    .from("buyer_favorites")
    .select("id")
    .eq("user_id", user.id)
    .returns<{ id: string }[]>();

  const mineIds = new Set((mine ?? []).map((f) => f.id));
  for (const id of parsed.data.orderedIds) {
    if (!mineIds.has(id)) {
      return fail("Cannot reorder a favorite you do not own.");
    }
  }

  const updates = parsed.data.orderedIds.map((id, index) => ({
    id,
    user_id: user.id,
    tier_rank: index + 1,
  }));

  const { error } = await supabase.from("buyer_favorites").upsert(updates);
  if (error) {
    return fail(error.message);
  }

  revalidatePath("/favorites");
  return ok(undefined);
}

/**
 * Remove a favorite from the list.
 */
export async function removeFavorite(
  favoriteId: string,
): Promise<ActionResult<undefined>> {
  const user = await requireUserOrThrow();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("buyer_favorites")
    .delete()
    .eq("id", favoriteId)
    .eq("user_id", user.id);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/favorites");
  return ok(undefined);
}
