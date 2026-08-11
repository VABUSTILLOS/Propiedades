import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { BidsRow } from "@/modules/lib/database.types";

/**
 * Bids on a property — visible to the owner (via property ownership RLS).
 */
export async function getPropertyBids(
  propertyId: string,
): Promise<BidsRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("bids")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .returns<BidsRow[]>();

  return rows ?? [];
}

/**
 * Bids the current user has submitted or received (via property ownership).
 */
export async function getMyBids(userId: string): Promise<BidsRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("bids")
    .select("*")
    .or(`buyer_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .returns<BidsRow[]>();

  return rows ?? [];
}
