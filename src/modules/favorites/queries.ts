import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import {
  createSupabaseServiceClient,
  serviceRoleConfigured,
} from "@/modules/lib/supabase/service";
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
 * The site owner's (admin's) favorite property ids — the public
 * «Favoritas» set that visitors who are not signed in see (Victor's
 * ask, 2026-11-22: any visitor can see the favorites). Read with the
 * service client because an anonymous session cannot read another
 * user's buyer_favorites rows under RLS; only the ids are exposed,
 * and they only ever point at public active listings.
 */
export async function getOwnerFavoriteIds(): Promise<string[]> {
  if (!serviceRoleConfigured()) return [];

  const supabase = createSupabaseServiceClient();

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .returns<{ id: string }[]>();

  const ownerId = admins?.[0]?.id;
  if (!ownerId) return [];

  const { data } = await supabase
    .from("buyer_favorites")
    .select("property_id")
    .eq("user_id", ownerId)
    .returns<{ property_id: string }[]>();

  return (data ?? []).map((row) => row.property_id);
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
