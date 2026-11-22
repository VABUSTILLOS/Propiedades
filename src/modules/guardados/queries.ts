import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { MarketplaceSavedListingsRow } from "@/modules/lib/database.types";

/**
 * A saved listing plus the live state of the property it was imported
 * into, so the UI can tell "imported and visible in Comprar/Rentas"
 * apart from "imported but still a draft / soft-deleted" and offer the
 * «Agregar a Comprar» button exactly where it is missing.
 */
export type SavedListingWithPortalState = MarketplaceSavedListingsRow & {
  portal_status: string | null;
  portal_type: string | null;
};

/**
 * All saved Marketplace listings for /admin/guardados, in saved order.
 * The dataset is small (hundreds), so search / sort / filters run on the
 * client; this returns every workflow state and the page splits views.
 * Relies on the admin-only RLS policy (migration 052).
 */
export async function getMarketplaceSavedListings(): Promise<SavedListingWithPortalState[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("marketplace_saved_listings")
    .select("*")
    .order("saved_order", { ascending: true, nullsFirst: false })
    .order("listing_created_at", { ascending: false })
    .returns<MarketplaceSavedListingsRow[]>();

  const rows = data ?? [];

  const propertyIds = rows
    .map((r) => r.imported_property_id)
    .filter((id): id is string => Boolean(id));

  const portalById = new Map<string, { status: string; type: string }>();
  if (propertyIds.length > 0) {
    const { data: props } = await supabase
      .from("properties")
      .select("id, status, type")
      .in("id", propertyIds)
      .returns<{ id: string; status: string; type: string }[]>();
    for (const p of props ?? []) {
      portalById.set(p.id, { status: p.status, type: p.type });
    }
  }

  return rows.map((row) => {
    const portal = row.imported_property_id
      ? portalById.get(row.imported_property_id)
      : undefined;
    return {
      ...row,
      portal_status: portal?.status ?? null,
      portal_type: portal?.type ?? null,
    };
  });
}
