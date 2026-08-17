"use server";

import { cookies } from "next/headers";

import { getCurrentUser } from "@/modules/auth/session";
import { ok, failAuth, type ActionResult } from "@/modules/lib/action-result";

/**
 * Master-user (admin) "editor mode": a per-browser cookie that reveals
 * quick-edit affordances (an "Editar" link on property cards and the detail
 * page) pointing at the admin wizard. Only admins can enable it; the cookie
 * itself is a harmless UX flag that RLS / server actions still enforce.
 */
const EDITOR_MODE_COOKIE = "editor_mode";
const EDITOR_MODE_ON = "1";

/** Whether the current request has editor mode enabled (admin only). */
export async function isEditorMode(): Promise<boolean> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return false;

  const cookieStore = await cookies();
  return cookieStore.get(EDITOR_MODE_COOKIE)?.value === EDITOR_MODE_ON;
}

/** Toggle editor mode on/off for the current browser session. */
export async function toggleEditorMode(): Promise<ActionResult<{ on: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return failAuth();
  if (user.role !== "admin") {
    return { ok: false, error: "Solo el usuario master puede activar el modo editor." };
  }

  const cookieStore = await cookies();
  const currentlyOn = cookieStore.get(EDITOR_MODE_COOKIE)?.value === EDITOR_MODE_ON;
  const next = !currentlyOn;

  if (next) {
    cookieStore.set(EDITOR_MODE_COOKIE, EDITOR_MODE_ON, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    cookieStore.delete(EDITOR_MODE_COOKIE);
  }

  return ok({ on: next });
}
