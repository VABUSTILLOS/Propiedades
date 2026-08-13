import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { DigitalFlyersRow } from "@/modules/lib/database.types";

export type DashboardStats = {
  /** Propiedades del usuario con status "active". */
  activeListings: number;
  /** Favoritos guardados en la lista privada del usuario. */
  favorites: number;
  /** Transacciones en curso (como comprador o como listador). */
  activeTransactions: number;
  /** Suma de vistas de los flyers digitales del usuario. */
  flyerViews: number;
};

/**
 * Métricas del panel de control. Solo tablas legibles por RLS para el propio
 * usuario (properties, buyer_favorites, transactions, digital_flyers) —
 * mortgage_leads es INSERT-only y queda fuera a propósito.
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = await createSupabaseServerClient();

  const [listings, favorites, txAsBuyer, txAsOwner, flyers] = await Promise.all([
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("status", "active"),
    supabase
      .from("buyer_favorites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", userId)
      .not("state", "in", '("closed","canceled")'),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("listing_owner_id", userId)
      .not("state", "in", '("closed","canceled")'),
    supabase
      .from("digital_flyers")
      .select("views_count")
      .eq("agent_id", userId)
      .returns<Pick<DigitalFlyersRow, "views_count">[]>(),
  ]);

  const flyerViews = (flyers.data ?? []).reduce(
    (sum, flyer) => sum + (flyer.views_count ?? 0),
    0,
  );

  return {
    activeListings: listings.count ?? 0,
    favorites: favorites.count ?? 0,
    activeTransactions: (txAsBuyer.count ?? 0) + (txAsOwner.count ?? 0),
    flyerViews,
  };
}
