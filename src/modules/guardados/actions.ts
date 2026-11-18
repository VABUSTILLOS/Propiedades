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
 * Turn a saved property listing into a draft property, reusing the
 * Universal Importer's createImportedDraft (same validation, slug and
 * draft state as a URL import). On success the saved row is marked
 * 'imported' and linked to the new property.
 */
export async function importSavedListing(
  id: string,
): Promise<ActionResult<{ propertyId: string; slug: string }>> {
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

  const created = await createImportedDraft(buildImportedDraftPayload(row));
  if (!created.ok) {
    return fail(`No se pudo crear el borrador: ${created.error}`);
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
    // The draft exists; only the bookkeeping failed. Say so plainly so the
    // admin can find the draft in /my-listings instead of importing twice.
    return fail(
      `El borrador se creó (id ${created.data.id}), pero no se pudo marcar la publicación como importada: ${error.message}`,
    );
  }

  revalidatePath("/admin/guardados");
  revalidatePath("/my-listings");
  return ok({ propertyId: created.data.id, slug: created.data.slug });
}
