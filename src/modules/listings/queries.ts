import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { PropertiesRow } from "@/modules/lib/database.types";

/**
 * Fetch a single listing by slug (public read — RLS restricts to active).
 */
export async function getListingBySlug(slug: string): Promise<PropertiesRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("properties")
    .select("*")
    .eq("slug", slug)
    .returns<PropertiesRow[]>()
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Fetch a single listing by id (public read — RLS restricts to active).
 */
export async function getListingById(id: string): Promise<PropertiesRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .returns<PropertiesRow[]>()
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Fetch the current user's listings (drafts included — owner RLS scope).
 */
export async function getMyListings(ownerId: string): Promise<PropertiesRow[]> {
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

  let query = supabase.from("properties").select("*").eq("status", "active");

  if (options?.type) {
    query = query.eq("type", options.type);
  }

  const { data: rows } = await query
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 24)
    .returns<PropertiesRow[]>();

  return rows ?? [];
}
