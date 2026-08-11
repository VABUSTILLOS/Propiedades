import "server-only";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { AvailabilitySlotsRow } from "@/modules/lib/database.types";

/**
 * Upcoming, unbooked slots for a property. RLS exposes slots to
 * authenticated users so buyers can book tours.
 */
export async function getAvailableSlots(
  propertyId: string,
): Promise<AvailabilitySlotsRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("property_id", propertyId)
    .eq("is_booked", false)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .returns<AvailabilitySlotsRow[]>();

  return rows ?? [];
}

/**
 * All slots for a property (owner view).
 */
export async function getPropertySlots(
  propertyId: string,
): Promise<AvailabilitySlotsRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("property_id", propertyId)
    .order("start_time", { ascending: true })
    .returns<AvailabilitySlotsRow[]>();

  return rows ?? [];
}
