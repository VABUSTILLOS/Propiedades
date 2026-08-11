"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { z } from "zod";

import { fail, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import {
  propertyCreateSchema,
  propertyWizardStep1Schema,
  propertyWizardStep2Schema,
  propertyWizardStep3Schema,
  propertyWizardStep4Schema,
} from "@/modules/lib/schemas";
import type { PropertiesRow } from "@/modules/lib/database.types";
import { buildUniqueSlug } from "@/modules/listings/slug";
import { importedPropertyDraftSchema } from "@/modules/importer/schemas";

type WizardStep = 1 | 2 | 3 | 4;

/**
 * Create a new draft listing from the wizard's first step.
 * Returns the created listing id so the client can continue editing.
 */
export async function createDraft(
  _prevState: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(
    propertyWizardStep1Schema,
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const slug = await buildUniqueSlug(parsed.data.title, async (candidate) => {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    return (data?.length ?? 0) > 0;
  });

  const { data, error } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      type: parsed.data.type,
      description: parsed.data.description ?? null,
      slug,
      status: "draft",
      current_wizard_step: 1,
    })
    .select("id")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-listings");
  return ok({ id: data.id });
}

/**
 * Save a specific wizard step for an existing draft.
 * Only the property owner can mutate (enforced server-side + RLS).
 */
export async function saveWizardStep(
  listingId: string,
  step: WizardStep,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();

  const schemaMap: Record<WizardStep, z.ZodTypeAny> = {
    1: propertyWizardStep1Schema,
    2: propertyWizardStep2Schema,
    3: propertyWizardStep3Schema,
    4: propertyWizardStep4Schema,
  };

  const parsed = parseInput(schemaMap[step], input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Ownership check — defense in depth beyond RLS.
  const { data: existing } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", listingId)
    .limit(1);
  if (existing?.[0]?.owner_id !== user.id) {
    return fail("You do not own this listing.");
  }

  const nextStep = (Math.min(step + 1, 4) as WizardStep);
  const { error } = await supabase
    .from("properties")
    .update({
      ...(parsed.data as Record<string, unknown>),
      current_wizard_step: nextStep,
    })
    .eq("id", listingId);

  if (error) {
    return fail(error.message);
  }

  return ok({ id: listingId });
}

/**
 * Publish (or archive) a listing once the wizard is complete.
 * Validation ensures all steps are filled before activation.
 */
export async function setListingStatus(
  listingId: string,
  status: "active" | "archived",
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserOrThrow();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("properties")
    .select("*")
    .eq("id", listingId)
    .returns<PropertiesRow[]>()
    .limit(1);

  const listing = existing?.[0];
  if (!listing) {
    return fail("Listing not found.");
  }
  if (listing.owner_id !== user.id) {
    return fail("You do not own this listing.");
  }

  if (status === "active") {
    // Enforce wizard completeness: all four steps have valid data.
    const full = parseInput(propertyCreateSchema, {
      title: listing.title,
      type: listing.type,
      description: listing.description ?? undefined,
      price: listing.price,
      currency: listing.currency,
      terreno_m2: listing.terreno_m2,
      construccion_m2: listing.construccion_m2,
      address: listing.address,
      colonia: listing.colonia,
      city: listing.city,
      state: listing.state,
      zip_code: listing.zip_code ?? undefined,
      lat: listing.lat,
      lng: listing.lng,
      images: listing.images ?? [],
      tour_360_url: listing.tour_360_url ?? undefined,
      video_url: listing.video_url ?? undefined,
    });

    if (!full.success) {
      return fail("Complete all wizard steps before publishing.");
    }
  }

  const { error } = await supabase
    .from("properties")
    .update({ status })
    .eq("id", listingId);

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-listings");
  return ok({ id: listingId });
}

/**
 * Hard-delete a draft (soft-archive is preferred for live listings).
 */
export async function deleteListing(listingId: string): Promise<ActionResult<undefined>> {
  const user = await requireUserOrThrow();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("properties")
    .select("owner_id, status")
    .eq("id", listingId)
    .limit(1);

  if (existing?.[0]?.owner_id !== user.id) {
    return fail("You do not own this listing.");
  }

  const { error } = await supabase.from("properties").delete().eq("id", listingId);
  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-listings");
  return ok(undefined);
}

/**
 * Persist a property imported via the Universal Importer as a draft listing.
 */
export async function createImportedDraft(
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await requireUserOrThrow();
  const parsed = parseInput(importedPropertyDraftSchema, input);
  if (!parsed.success) {
    return fail(parsed.error, parsed.fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const slug = await buildUniqueSlug(parsed.data.title, async (candidate) => {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("slug", candidate)
      .limit(1);
    return (data?.length ?? 0) > 0;
  });

  const { data, error } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      title: parsed.data.title,
      type: "sale",
      description: parsed.data.description || null,
      slug,
      status: "draft",
      current_wizard_step: 4,
      price: parsed.data.price,
      currency: parsed.data.currency,
      terreno_m2: parsed.data.terreno_m2,
      construccion_m2: parsed.data.construccion_m2,
      address: parsed.data.address,
      colonia: parsed.data.colonia,
      city: parsed.data.city,
      state: parsed.data.state,
      zip_code: parsed.data.zip_code,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      images: parsed.data.images,
      source_url: parsed.data.source_url,
      puntos_fuertes_bento: parsed.data.bento_highlights,
    })
    .select("id, slug")
    .single();

  if (error) {
    return fail(error.message);
  }

  revalidatePath("/my-listings");
  revalidatePath("/favorites");
  return ok({ id: data.id, slug: data.slug });
}
