"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/session";
import { fail, failAuth, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { MarketplaceSavedListingsRow } from "@/modules/lib/database.types";
import { createImportedDraft } from "@/modules/listings/actions";
import { buildImportedDraftPayload } from "@/modules/guardados/mapping";

const idSchema = z.string().uuid();

async function requireAdmin(): Promise<ActionResult<never> | null> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  if (user.role !== "admin") {
    return fail("Solo el usuario master puede gestionar los guardados de Marketplace.");
  }
  return null;
}

async function setSavedListingStatus(
  id: string,
  status: "discarded" | "active",
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseInput(idSchema, id);
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("marketplace_saved_listings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data)
    // Never resurrect or hide a listing that already became a property.
    .neq("status", "imported");

  if (error) return fail(error.message);

  revalidatePath("/admin/guardados");
  return ok({ id: parsed.data });
}

/** Hide a saved listing from the main view (restorable from "Descartados"). */
export async function discardSavedListing(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return setSavedListingStatus(id, "discarded");
}

/** Bring a discarded saved listing back to the main view. */
export async function restoreSavedListing(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return setSavedListingStatus(id, "active");
}

/**
 * Turn a saved property listing into a LIVE property on the portal,
 * reusing the Universal Importer's createImportedDraft for validation
 * and slug generation, then publishing it in the same request: sales
 * land in Comprar (/search, type "sale"), rentals in Rentas (type
 * "rent"). On success the saved row is marked 'imported' and linked
 * to the new property.
 */
export async function importSavedListing(
  id: string,
): Promise<ActionResult<{ propertyId: string; slug: string; section: "Comprar" | "Rentas" }>> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = parseInput(idSchema, id);
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("marketplace_saved_listings")
    .select("*")
    .eq("id", parsed.data)
    .limit(1)
    .returns<MarketplaceSavedListingsRow[]>();

  const row = rows?.[0];
  if (!row) return fail("No se encontró la publicación guardada.");
  if (!row.is_property) {
    return fail("Solo las publicaciones de propiedades se pueden importar al portal.");
  }
  if (row.status === "imported") {
    return fail("Esta publicación ya fue importada a propiedades.");
  }
  if (row.status === "discarded") {
    return fail("Esta publicación está descartada. Restáurala antes de importarla.");
  }

  const payload = buildImportedDraftPayload(row);
  const created = await createImportedDraft(payload);
  if (!created.ok) {
    return fail(`No se pudo crear la propiedad: ${created.error}`);
  }

  // Publish immediately: imports land live on the portal, not as drafts
  // waiting for the wizard. createImportedDraft always inserts
  // status "draft" and type "sale", so set both here — rentals must
  // carry type "rent" to appear in Rentas instead of Comprar.
  const isRent = payload.deal_type === "renta";
  const section = isRent ? "Rentas" : "Comprar";
  const { error: publishError } = await supabase
    .from("properties")
    .update({ status: "active", type: isRent ? "rent" : "sale" })
    .eq("id", created.data.id);

  if (publishError) {
    // The property exists as a draft; only publishing failed. Say so
    // plainly so the admin can publish it from the editor instead of
    // importing twice.
    return fail(
      `La propiedad se creó como borrador (id ${created.data.id}), pero no se pudo publicar: ${publishError.message}`,
    );
  }

  const { error } = await supabase
    .from("marketplace_saved_listings")
    .update({
      status: "imported",
      imported_property_id: created.data.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) {
    // The property is live; only the bookkeeping failed. Say so plainly
    // so the admin does not import twice and create a duplicate.
    return fail(
      `La propiedad se publicó (id ${created.data.id}), pero no se pudo marcar la publicación como importada: ${error.message}`,
    );
  }

  revalidatePath("/admin/guardados");
  revalidatePath("/my-listings");
  revalidatePath("/search");
  revalidatePath("/rentas");
  return ok({ propertyId: created.data.id, slug: created.data.slug, section });
}
