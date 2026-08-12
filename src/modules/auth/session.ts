import { cache } from "react";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { env } from "@/modules/lib/env";
import type { ProfilesRow, UserRole } from "@/modules/lib/database.types";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
};

/**
 * Get the current authenticated user (cached per request).
 * Returns null when unauthenticated — never throws.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  if (!env.supabaseConfigured) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .returns<ProfilesRow[]>()
    .limit(1);

  const profile = profiles?.[0] ?? null;

  if (!profile) {
    // Trigger should have created the profile; fall back to auth metadata.
    const meta = user.user_metadata as Record<string, unknown> | null;
    return {
      id: user.id,
      email: user.email ?? "",
      fullName: typeof meta?.full_name === "string" ? meta.full_name : "",
      role: typeof meta?.role === "string" ? (meta.role as UserRole) : "buyer",
    };
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
  };
});

/**
 * Get the current user or redirect to sign-in with a next redirect param.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
}

/**
 * Get the current user or throw — for Server Actions / API contexts where
 * redirect() is not appropriate.
 */
export async function requireUserOrThrow(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Se requiere autenticación");
  }
  return user;
}

/**
 * Guard: only allow users whose role is in the provided set.
 */
export async function requireRole(
  allowedRoles: readonly UserRole[],
): Promise<AuthUser> {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}
