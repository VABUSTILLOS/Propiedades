import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { MarketplaceSavedListingsRow } from "@/modules/lib/database.types";

/**
 * All saved Marketplace listings for /admin/guardados, in saved order.
 * The dataset is small (hundreds), so search / sort / filters run on the
 * client; this returns every workflow state and the page splits views.
 * Relies on the admin-only RLS policy (migration 052).
 */
export async function getMarketplaceSavedListings(): Promise<MarketplaceSavedListingsRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("marketplace_saved_listings")
    .select("*")
    .order("saved_order", { ascending: true, nullsFirst: false })
    .order("listing_created_at", { ascending: false })
    .returns<MarketplaceSavedListingsRow[]>();

  return data ?? [];
}
