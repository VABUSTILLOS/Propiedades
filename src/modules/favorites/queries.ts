import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { BuyerFavoritesRow, PropertiesRow } from "@/modules/lib/database.types";

export type FavoriteWithProperty = BuyerFavoritesRow & {
  property: PropertiesRow | null;
};

/**
 * The user's favorite properties, ordered by tier_rank (1 = highest).
 */
export async function getMyFavorites(
  userId: string,
): Promise<FavoriteWithProperty[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("buyer_favorites")
    .select("*, property:properties(*)")
    .eq("user_id", userId)
    .order("tier_rank", { ascending: true })
    .returns<FavoriteWithProperty[]>();

  return rows ?? [];
}

/**
 * The ids of the user's favorite properties — for marking cards in grids.
 */
export async function getMyFavoriteIds(userId: string): Promise<Set<string>> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("buyer_favorites")
    .select("property_id")
    .eq("user_id", userId)
    .returns<{ property_id: string }[]>();

  return new Set((data ?? []).map((row) => row.property_id));
}

/**
 * Whether a specific property is already in the user's favorites.
 */
export async function isFavoriteSaved(
  userId: string,
  propertyId: string,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("buyer_favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .limit(1);

  return Boolean(data?.[0]);
}
