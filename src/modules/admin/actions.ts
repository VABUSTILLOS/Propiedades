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
