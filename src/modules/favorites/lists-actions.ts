"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, failAuth, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import {
  favoriteListAddSchema,
  favoriteListCreateSchema,
  favoriteListRemoveItemSchema,
  favoriteListUpdateSchema,
} from "@/modules/lib/schemas";
import { ensureFavorite } from "@/modules/favorites/ensure-favorite";

/**
 * Create a new personal favorites list.
 */
export async function createList(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const parsed = parseInput(favoriteListCreateSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("favorite_lists")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/favorites");
  return ok({ id: data.id });
}

/**
 * Rename / update the description of a list owned by the caller.
 */
export async function updateList(
  input: Record<string, unknown>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const parsed = parseInput(favoriteListUpdateSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("favorite_lists")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .eq("id", parsed.data.listId)
    .eq("user_id", user.id);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/favorites");
  return ok(undefined);
}

/**
 * Delete a list and its items (cascade).
 */
export async function deleteList(
  listId: string,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("favorite_lists")
    .delete()
    .eq("id", listId)
    .eq("user_id", user.id);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/favorites");
  return ok(undefined);
}

/**
 * Add a property to one or more lists. The property is also saved as a
 * favorite when it is not already (lists are linked to favorites).
 */
export async function addPropertyToLists(
  input: Record<string, unknown>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const parsed = parseInput(favoriteListAddSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Only allow the user's own lists.
  const { data: ownedLists } = await supabase
    .from("favorite_lists")
    .select("id")
    .eq("user_id", user.id)
    .in("id", parsed.data.listIds)
    .returns<{ id: string }[]>();
  const ownedIds = new Set((ownedLists ?? []).map((l) => l.id));
  if (ownedIds.size !== parsed.data.listIds.length) {
    return fail("Cannot add to a list you do not own.");
  }

  const { favoriteId } = await ensureFavorite(user.id, parsed.data.propertyId);

  const { data: existingItems } = await supabase
    .from("favorite_list_items")
    .select("list_id, position")
    .eq("favorite_id", favoriteId)
    .in("list_id", parsed.data.listIds)
    .returns<{ list_id: string; position: number }[]>();

  const maxPositionByList = new Map<string, number>();
  for (const item of existingItems ?? []) {
    maxPositionByList.set(
      item.list_id,
      Math.max(maxPositionByList.get(item.list_id) ?? -1, item.position),
    );
  }

  const rows = parsed.data.listIds.map((listId, index) => ({
    list_id: listId,
    favorite_id: favoriteId,
    position: (maxPositionByList.get(listId) ?? -1) + index + 1,
  }));

  const { error } = await supabase
    .from("favorite_list_items")
    .upsert(rows, { onConflict: "list_id,favorite_id" });

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/favorites");
  return ok(undefined);
}

/**
 * Remove a property from a list. The favorite itself is kept — the user
 * can still find it under Favoritos.
 */
export async function removeFromList(
  input: Record<string, unknown>,
): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  const parsed = parseInput(favoriteListRemoveItemSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("favorite_list_items")
    .delete()
    .eq("list_id", parsed.data.listId)
    .eq("favorite_id", parsed.data.favoriteId);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/favorites");
  return ok(undefined);
}
