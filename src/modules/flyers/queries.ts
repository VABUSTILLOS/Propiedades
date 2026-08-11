import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { DigitalFlyersRow, FlyerAnalyticsRow } from "@/modules/lib/database.types";

/**
 * Fetch a flyer by its public slug (public read — RLS allows SELECT).
 */
export async function getFlyerBySlug(
  slug: string,
): Promise<DigitalFlyersRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("digital_flyers")
    .select("*")
    .eq("slug", slug)
    .returns<DigitalFlyersRow[]>()
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Fetch a single flyer owned by the given agent (owner scope via RLS).
 */
export async function getMyFlyerById(
  id: string,
  agentId: string,
): Promise<DigitalFlyersRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("digital_flyers")
    .select("*")
    .eq("id", id)
    .eq("agent_id", agentId)
    .returns<DigitalFlyersRow[]>()
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Flyers the caller has created (owner scope via RLS).
 */
export async function getMyFlyers(agentId: string): Promise<DigitalFlyersRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("digital_flyers")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .returns<DigitalFlyersRow[]>();

  return rows ?? [];
}

/**
 * Engagement analytics for a flyer the caller owns (owner scope via RLS).
 */
export async function getFlyerAnalytics(
  flyerId: string,
): Promise<FlyerAnalyticsRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("flyer_analytics")
    .select("*")
    .eq("flyer_id", flyerId)
    .order("opened_at", { ascending: false })
    .returns<FlyerAnalyticsRow[]>();

  return rows ?? [];
}
