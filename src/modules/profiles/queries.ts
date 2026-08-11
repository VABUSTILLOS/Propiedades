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
 * Only hosts under the platform apex are treated as tenants:
 * `agencia.tuportal.com` → `agencia` (apex = `tuportal.com`).
 * The apex itself, `www.` and unrelated hosts → null.
 */
export function subdomainFromHost(
  host: string,
  platformApex: string,
): string | null {
  const clean = host.replace(/:\d+$/, "").toLowerCase();
  if (!clean || clean === platformApex || clean === `www.${platformApex}`) {
    return null;
  }
  const suffix = `.${platformApex}`;
  if (!clean.endsWith(suffix)) return null;
  const subdomain = clean.slice(0, -suffix.length);
  if (!subdomain || subdomain === "www") return null;
  return subdomain;
}

/**
 * Directory of agent profiles for the MLS network page.
 */
export const getAgentDirectory = cache(
  async (): Promise<ProfilesRow[]> => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "agent")
      .order("full_name", { ascending: true })
      .returns<ProfilesRow[]>();
    return data ?? [];
  },
);
