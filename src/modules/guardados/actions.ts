"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/session";
import { fail, failAuth, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { MarketplaceSavedListingsRow } from "@/modules/lib/database.types";
import { createImportedDraft } from "@/modules/listings/actions";
import { buildImportedDraftPayload } from "@/modules/guardados/mapping";
import { reorderImageUrls } from "@/modules/admin/image-list";

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

/**
 * Permanently remove an imported property from the portal: deletes the
 * property row (favorites cascade, per the schema), its imported photos
 * in Storage, and the saved-listing row itself, so the property leaves
 * Comprar/Rentas and the Guardados list in one step. There is no undo.
 */
export async function deleteImportedProperty(
  id: string,
): Promise<ActionResult<{ propertyId: string }>> {
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
  if (row.status !== "imported" || !row.imported_property_id) {
    return fail("Esta publicación todavía no está publicada en el portal.");
  }

  const propertyId = row.imported_property_id;

  // Read the property's images first so its Storage files can be removed
  // once the row is gone. Only this listing's own imported photos
  // (marketplace/<listing_id>/…) are ever touched.
  const { data: props } = await supabase
    .from("properties")
    .select("images")
    .eq("id", propertyId)
    .limit(1)
    .returns<{ images: string[] | null }[]>();
  const imageUrls = props?.[0]?.images ?? row.photo_urls ?? [];
  const prefix = `marketplace/${row.listing_id}/`;
  const storagePaths = imageUrls
    .map((url) => {
      const marker = "/property-images/";
      const idx = url.indexOf(marker);
      return idx >= 0 ? url.slice(idx + marker.length) : null;
    })
    .filter((p): p is string => p !== null && p.startsWith(prefix));

  const { error: deleteError } = await supabase
    .from("properties")
    .delete()
    .eq("id", propertyId);
  if (deleteError) {
    return fail(`No se pudo borrar la propiedad: ${deleteError.message}`);
  }

  // Best effort: the property is already off the portal, so a Storage
  // failure must not fail the action — orphaned files are not visible.
  if (storagePaths.length > 0) {
    await supabase.storage.from("property-images").remove(storagePaths);
  }

  const { error } = await supabase
    .from("marketplace_saved_listings")
    .delete()
    .eq("id", row.id);
  if (error) {
    // The property is off the portal; only the bookkeeping failed. Say so
    // plainly so the admin knows the row may still show in Guardados.
    return fail(
      `La propiedad se borró del portal, pero no se pudo quitar de Guardados: ${error.message}`,
    );
  }

  revalidatePath("/admin/guardados");
  revalidatePath("/my-listings");
  revalidatePath("/search");
  revalidatePath("/rentas");
  revalidatePath("/");
  return ok({ propertyId });
}

/**
 * Reorder a saved listing's photos (master only). The first photo is the
 * cover everywhere. Only URLs already stored on the row are kept, in the
 * given order. When the listing was already imported, the property's
 * gallery is updated to the same order so Guardados and the public
 * listings never disagree about the cover.
 */
export async function reorderSavedListingPhotos(
  id: string,
  orderedUrls: string[],
): Promise<ActionResult<{ photo_urls: string[] }>> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsedId = parseInput(idSchema, id);
  if (!parsedId.success) return fail(parsedId.error);
  const parsedUrls = parseInput(
    z.array(z.string().url()).max(50),
    orderedUrls,
  );
  if (!parsedUrls.success) return fail(parsedUrls.error);

  const supabase = await createSupabaseServerClient();
  const { data: row, error: fetchError } = await supabase
    .from("marketplace_saved_listings")
    .select("photo_urls, imported_property_id")
    .eq("id", parsedId.data)
    .single();
  if (fetchError) return fail(fetchError.message);

  const current = (row?.photo_urls as string[] | null) ?? [];
  const next = reorderImageUrls(current, parsedUrls.data);
  if (current.length > 0 && next.length === 0) {
    return fail("El orden enviado no coincide con las fotos guardadas.");
  }

  const { error } = await supabase
    .from("marketplace_saved_listings")
    .update({
      photo_urls: next,
      primary_photo_url: next[0] ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsedId.data);
  if (error) return fail(error.message);

  if (row?.imported_property_id) {
    const { error: propertyError } = await supabase
      .from("properties")
      .update({ images: next })
      .eq("id", row.imported_property_id);
    if (propertyError) return fail(propertyError.message);
    revalidatePath(`/property/[slug]`, "page");
    revalidatePath("/search");
    revalidatePath("/rentas");
  }

  revalidatePath("/admin/guardados");
  return ok({ photo_urls: next });
}
