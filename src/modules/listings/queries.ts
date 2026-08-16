import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { PropertiesRow } from "@/modules/lib/database.types";

/**
 * Fetch a single listing by slug (public read — RLS restricts to active).
 * Wrapped in React cache() so generateMetadata and the page body share one
 * query per request instead of hitting the DB twice.
 */
export const getListingBySlug = cache(
  async (slug: string): Promise<PropertiesRow | null> => {
    const supabase = await createSupabaseServerClient();

    const { data: rows } = await supabase
      .from("properties")
      .select("*")
      .eq("slug", slug)
      .returns<PropertiesRow[]>()
      .limit(1);

    return rows?.[0] ?? null;
  },
);

/**
 * Fetch a single listing by id (public read — RLS restricts to active).
 * Wrapped in React cache() to dedupe same-request fetches.
 */
export const getListingById = cache(
  async (id: string): Promise<PropertiesRow | null> => {
    const supabase = await createSupabaseServerClient();

    const { data: rows } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .returns<PropertiesRow[]>()
      .limit(1);

    return rows?.[0] ?? null;
  },
);

/**
 * Fetch the current user's listings (drafts included — owner RLS scope).
 */export async function getMyListings(ownerId: string): Promise<PropertiesRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .returns<PropertiesRow[]>();

  return rows ?? [];
}

/**
 * Active listings for the marketplace grid.
 */
export async function getActiveListings(options?: {
  limit?: number;
  type?: "sale" | "rent";
}): Promise<PropertiesRow[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("properties").select("*").eq("status", "active").gt("image_count", 1);

  if (options?.type) {
    query = query.eq("type", options.type);
  }

  const { data: rows } = await query
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 24)
    .returns<PropertiesRow[]>();

  return rows ?? [];
}

/**
 * Active listings owned by a specific agent/owner (tenant microsite feed).
 */
export async function getActiveListingsByOwner(
  ownerId: string,
  options?: { limit?: number },
): Promise<PropertiesRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("properties")
    .select("*")
    .eq("status", "active")
    .eq("owner_id", ownerId)
    .gt("image_count", 1)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 30)
    .returns<PropertiesRow[]>();

  return rows ?? [];
}

/**
 * MLS-shared listings for the agent-only network. `is_mls` listings are
 * private to agents per RLS; regular active listings are readable publicly.
 */
export async function getMlsListings(options?: {
  limit?: number;
}): Promise<PropertiesRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("properties")
    .select("*")
    .eq("status", "active")
    .eq("is_mls", true)
    .gt("image_count", 1)
    .order("updated_at", { ascending: false })
    .limit(options?.limit ?? 60)
    .returns<PropertiesRow[]>();

  return rows ?? [];
}

/**
 * Similar listings for the "Propiedades similares" section: same deal type
 * (sale/rent), same property category, same city, and price within ±25% of
 * the current listing. Ranked by colonia match first, then price closeness.
 */
export async function getSimilarListings(
  listing: PropertiesRow,
  limit = 3,
): Promise<PropertiesRow[]> {
  if (listing.price <= 0) return [];

  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("properties")
    .select("*")
    .eq("status", "active")
    .eq("type", listing.type)
    .eq("category", listing.category)
    .eq("city", listing.city)
    .gt("image_count", 1)
    .neq("id", listing.id)
    .gte("price", listing.price * 0.75)
    .lte("price", listing.price * 1.25)
    .limit(12)
    .returns<PropertiesRow[]>();

  const ranked = (rows ?? []).sort((a, b) => {
    const aColonia = a.colonia === listing.colonia ? 0 : 1;
    const bColonia = b.colonia === listing.colonia ? 0 : 1;
    if (aColonia !== bColonia) return aColonia - bColonia;
    return Math.abs(a.price - listing.price) - Math.abs(b.price - listing.price);
  });

  return ranked.slice(0, limit);
}

/**
 * Fetch up to 4 listings by ids for the side-by-side comparator.
 * Public read — RLS restricts to active listings.
 */
export async function getListingsByIds(ids: string[]): Promise<PropertiesRow[]> {
  if (ids.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("properties")
    .select("*")
    .in("id", ids.slice(0, 4))
    .returns<PropertiesRow[]>();

  return rows ?? [];
}
