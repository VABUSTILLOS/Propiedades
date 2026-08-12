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
