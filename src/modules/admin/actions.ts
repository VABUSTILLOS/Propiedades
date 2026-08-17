"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/modules/auth/session";
import { fail, failAuth, ok, parseInput, type ActionResult } from "@/modules/lib/action-result";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { PropertyStatus } from "@/modules/lib/database.types";

const bulkModerationSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(["archive", "delete", "restore"]),
});

const ACTION_TO_STATUS: Record<"archive" | "delete" | "restore", PropertyStatus> = {
  archive: "archived",
  delete: "deleted",
  restore: "active",
};

function revalidateModerationPaths(): void {
  revalidatePath("/search");
  revalidatePath("/rentas");
  revalidatePath("/admin/propiedades");
  revalidatePath("/dashboard");
}

/** Image upload constants (mirror listings/actions.ts for decoupling). */
const IMAGE_BUCKET = "property-images";
const MAX_WIZARD_IMAGES = 50;
const MAX_WIZARD_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_WIZARD_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function imageExtForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

/**
 * Bulk moderation for the master user (admin): archive, soft-delete or
 * restore properties regardless of owner. Soft-deleted properties stay
 * recoverable from "Propiedades borradas".
 */
export async function bulkModerateProperties(
  ids: string[],
  action: "archive" | "delete" | "restore",
): Promise<ActionResult<{ updated: number }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  if (user.role !== "admin") return fail("Solo el usuario master puede moderar propiedades.");

  const parsed = parseInput(bulkModerationSchema, { ids, action });
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("properties")
    .update({ status: ACTION_TO_STATUS[parsed.data.action] })
    .in("id", parsed.data.ids);

  if (error) return fail(error.message);

  revalidateModerationPaths();
  return ok({ updated: count ?? parsed.data.ids.length });
}

/**
 * Permanently delete properties from the trash ("Propiedades borradas").
 * Only allowed on already soft-deleted rows to avoid wiping live listings.
 */
export async function permanentDeleteProperties(
  ids: string[],
): Promise<ActionResult<{ deleted: number }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  if (user.role !== "admin") return fail("Solo el usuario master puede eliminar propiedades.");

  const parsed = parseInput(z.array(z.string().uuid()).min(1).max(200), ids);
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("properties")
    .delete()
    .in("id", parsed.data)
    .eq("status", "deleted");

  if (error) return fail(error.message);

  revalidateModerationPaths();
  return ok({ deleted: count ?? parsed.data.length });
}

/**
 * Get the current images array for a property (admin read).
 */
export async function getPropertyImages(
  propertyId: string,
): Promise<ActionResult<{ images: string[] }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  if (user.role !== "admin") return fail("Solo el usuario master puede ver imágenes.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .select("images")
    .eq("id", propertyId)
    .single();

  if (error) return fail(error.message);
  return ok({ images: (data?.images as string[] | null) ?? [] });
}

/**
 * Reorder a property's images array (admin write).
 */
export async function reorderPropertyImages(
  propertyId: string,
  orderedUrls: string[],
): Promise<ActionResult<{ images: string[] }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  if (user.role !== "admin") return fail("Solo el usuario master puede reordenar imágenes.");

  const parsed = parseInput(z.array(z.string().url()).max(MAX_WIZARD_IMAGES), orderedUrls);
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("properties")
    .update({ images: parsed.data })
    .eq("id", propertyId);

  if (error) return fail(error.message);

  revalidatePath("/admin/propiedades");
  revalidatePath(`/property/[slug]`);
  return ok({ images: parsed.data });
}

/**
 * Add images to a property's images array (admin write).
 */
export async function addPropertyImages(
  propertyId: string,
  newUrls: string[],
): Promise<ActionResult<{ images: string[] }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  if (user.role !== "admin") return fail("Solo el usuario master puede agregar imágenes.");

  const parsed = parseInput(z.array(z.string().url()).max(MAX_WIZARD_IMAGES), newUrls);
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("properties")
    .select("images")
    .eq("id", propertyId)
    .single();

  if (fetchError) return fail(fetchError.message);

  const current = (existing?.images as string[] | null) ?? [];
  const combined = [...current, ...parsed.data].slice(0, MAX_WIZARD_IMAGES);

  const { error } = await supabase
    .from("properties")
    .update({ images: combined })
    .eq("id", propertyId);

  if (error) return fail(error.message);

  revalidatePath("/admin/propiedades");
  revalidatePath(`/property/[slug]`);
  return ok({ images: combined });
}

/**
 * Remove a single image URL from a property's images array (admin write).
 */
export async function removePropertyImage(
  propertyId: string,
  urlToRemove: string,
): Promise<ActionResult<{ images: string[] }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  if (user.role !== "admin") return fail("Solo el usuario master puede eliminar imágenes.");

  const parsed = parseInput(z.string().url(), urlToRemove);
  if (!parsed.success) return fail(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("properties")
    .select("images")
    .eq("id", propertyId)
    .single();

  if (fetchError) return fail(fetchError.message);

  const current = (existing?.images as string[] | null) ?? [];
  const filtered = current.filter((u) => u !== parsed.data);

  const { error } = await supabase
    .from("properties")
    .update({ images: filtered })
    .eq("id", propertyId);

  if (error) return fail(error.message);

  revalidatePath("/admin/propiedades");
  revalidatePath(`/property/[slug]`);
  return ok({ images: filtered });
}

/**
 * Upload image files to Supabase Storage and return public URLs (admin write).
 * Reuses the same bucket and constraints as the wizard.
 */
export async function uploadAdminImages(
  formData: FormData,
): Promise<ActionResult<{ urls: string[] }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  if (user.role !== "admin") return fail("Solo el usuario master puede subir imágenes.");

  const files = formData
    .getAll("images")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (files.length === 0) return fail("Selecciona al menos una imagen.");
  if (files.length > MAX_WIZARD_IMAGES) {
    return fail(`Puedes subir hasta ${MAX_WIZARD_IMAGES} imágenes.`);
  }

  for (const file of files) {
    if (!ALLOWED_WIZARD_IMAGE_TYPES.has(file.type)) {
      return fail("Solo se aceptan imágenes JPG, PNG, WebP o GIF.");
    }
    if (file.size > MAX_WIZARD_IMAGE_SIZE) {
      return fail("Cada imagen debe pesar máximo 10 MB.");
    }
  }

  const supabase = await createSupabaseServerClient();
  const urls: string[] = [];

  for (const file of files) {
    const ext = imageExtForType(file.type);
    const path = `wizard/${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) return fail(error.message);

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    if (data.publicUrl) urls.push(data.publicUrl);
  }

  return ok({ urls });
}
