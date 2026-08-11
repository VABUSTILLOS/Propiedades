"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { env } from "@/modules/lib/env";
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
 * Push a WhatsApp alert to the flyer owner about high-value engagement.
 * Uses the configurable WHATSAPP_WEBHOOK_URL; gracefully no-ops when the
 * webhook is not configured so the agent dashboard works without it.
 */export async function sendFlyerWhatsAppAlert(
  input: Record<string, unknown>,
): Promise<ActionResult<{ sent: boolean }>> {
  const user = await requireUserOrThrow();

  const flyerId = typeof input.flyerId === "string" ? input.flyerId : "";
  const message =
    typeof input.message === "string" && input.message.trim()
      ? input.message.trim().slice(0, 500)
      : "";
  if (!flyerId || !message) {
    return fail("flyerId and message are required.");
  }

  // Verify ownership before sending.
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("digital_flyers")
    .select("id")
    .eq("id", flyerId)
    .eq("agent_id", user.id)
    .returns<{ id: string }[]>()
    .limit(1);

  if (!rows?.[0]) {
    return fail("Flyer not found.");
  }

  if (!env.whatsappWebhookUrl) {
    // Graceful degradation: webhook not configured.
    return ok({ sent: false });
  }

  try {
    const res = await fetch(env.whatsappWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flyerId, message }),
    });
    if (!res.ok) {
      return fail(`WhatsApp webhook responded with status ${res.status}.`);
    }
    return ok({ sent: true });
  } catch {
    return fail("Could not reach the WhatsApp webhook.");
  }
}
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

/**
 * White-label share: clone an existing public flyer and re-badge it as the
 * caller's own agency brand. The clone keeps the same property but points
 * `white_label_source_flyer_id` back to the original so the captor's
 * attribution stays intact.
 */
export async function shareWhiteLabel(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await requireUserOrThrow();

  const sourceSlug = typeof input.slug === "string" ? input.slug.trim() : "";
  if (!sourceSlug) {
    return fail("slug is required.");
  }

  const supabase = await createSupabaseServerClient();

  // Load the source flyer (public read is allowed for any active flyer).
  const { data: sourceRows } = await supabase
    .from("digital_flyers")
    .select("id, property_id, custom_title, slug")
    .eq("slug", sourceSlug)
    .returns<{ id: string; property_id: string; custom_title: string | null; slug: string }[]>()
    .limit(1);

  const source = sourceRows?.[0];
  if (!source) {
    return fail("Source flyer not found.");
  }

  // The intermediary agent must own the underlying property to share it.
  const { data: propRows } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", source.property_id)
    .returns<{ owner_id: string }[]>()
    .limit(1);

  if (propRows?.[0]?.owner_id !== user.id) {
    return fail("You do not own this property.");
  }

  const slug = `wl-${user.id.slice(0, 6)}-${source.slug.slice(0, 8)}`;

  const { data, error } = await supabase
    .from("digital_flyers")
    .insert({
      property_id: source.property_id,
      agent_id: user.id,
      slug,
      custom_title: source.custom_title,
      is_white_label: true,
      white_label_source_flyer_id: source.id,
    })
    .select("id, slug")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-flyers");
  return ok({ id: data.id, slug: data.slug });
}
