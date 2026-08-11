"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import {
  flyerAnalyticsSchema,
  flyerCreateSchema,
  flyerLeadSchema,
} from "@/modules/lib/schemas";

/**
 * Create a shareable digital flyer for a property the caller owns.
 */
export async function createFlyer(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(flyerCreateSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data: propRows } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", parsed.data.propertyId)
    .returns<{ id: string; owner_id: string }[]>()
    .limit(1);

  if (propRows?.[0]?.owner_id !== user.id) {
    return fail("You do not own this property.");
  }

  const slug = `${user.id.slice(0, 8)}-${parsed.data.propertyId.slice(0, 8)}`;

  const { data, error } = await supabase
    .from("digital_flyers")
    .insert({
      property_id: parsed.data.propertyId,
      agent_id: user.id,
      slug,
      custom_title: parsed.data.customTitle ?? null,
      is_white_label: parsed.data.isWhiteLabel,
    })
    .select("id, slug")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-flyers");
  return ok({ id: data.id, slug: data.slug });
}

/**
 * Record a flyer view / engagement (public — RLS allows insert).
 */
export async function recordFlyerAnalytics(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(flyerAnalyticsSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("flyer_analytics")
    .insert({
      flyer_id: parsed.data.flyerId,
      visitor_session_id: parsed.data.visitorSessionId,
      time_spent_seconds: parsed.data.timeSpentSeconds,
      sections_viewed: parsed.data.sectionsViewed,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  return ok({ id: data.id });
}

/**
 * Capture a lead from a flyer (email/phone opt-in).
 */
export async function captureFlyerLead(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(flyerLeadSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("flyer_analytics")
    .insert({
      flyer_id: parsed.data.flyerId,
      visitor_session_id: parsed.data.visitorSessionId,
      lead_email: parsed.data.email ?? null,
      lead_phone: parsed.data.phone ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  return ok({ id: data.id });
}
