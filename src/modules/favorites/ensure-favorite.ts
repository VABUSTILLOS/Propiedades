import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";

/**
 * Find-or-create the `buyer_favorites` row for a property. Returns the
 * favorite id so callers can link list items — lists reference favorites,
 * so adding a property to a list always keeps it saved as a favorite.
 */
export async function ensureFavorite(
  userId: string,
  propertyId: string,
  opts: { tierRank?: number; tierColumn?: string } = {},
): Promise<{ favoriteId: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("buyer_favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .limit(1);

  if (existing?.[0]) {
    return { favoriteId: existing[0].id };
  }

  const { data, error } = await supabase
    .from("buyer_favorites")
    .insert({
      user_id: userId,
      property_id: propertyId,
      tier_rank: opts.tierRank ?? 1,
      tier_column: opts.tierColumn ?? "top_choice",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return { favoriteId: data.id };
}
