import { cache } from "react";

import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import type { ProfilesRow } from "@/modules/lib/database.types";

/**
 * Loads an agency/agent profile by its tenant subdomain.
 * Returns null when the subdomain is not registered.
 */
export const getProfileBySubdomain = cache(
  async (subdomain: string): Promise<ProfilesRow | null> => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("subdomain", subdomain.toLowerCase().trim())
      .returns<ProfilesRow[]>()
      .limit(1);
    return data?.[0] ?? null;
  },
);

/**
 * Loads a profile by user id (cached per request).
 */
export const getProfileByUserId = cache(
  async (userId: string): Promise<ProfilesRow | null> => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .returns<ProfilesRow[]>()
      .limit(1);
    return data?.[0] ?? null;
  },
);

/**
 * Extracts a tenant subdomain from a request host header.
 * Handles `agencia.tuportal.com` → `agencia`, and bare apex hosts → null.
 * `www.` and the platform apex are not treated as tenant subdomains.
 */
export function subdomainFromHost(
  host: string,
  platformApex: string,
): string | null {
  const clean = host.replace(/:\d+$/, "").toLowerCase();
  if (!clean || clean === platformApex || clean === `www.${platformApex}`) {
    return null;
  }
  const parts = clean.split(".");
  if (parts.length < 3) return null;
  const candidate = parts[0] ?? null;
  if (!candidate || candidate === "www") return null;
  return candidate;
}
