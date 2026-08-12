"use server";

import { revalidatePath } from "next/cache";

import { requireUserOrThrow } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/modules/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/modules/lib/action-result";
import { DEFAULT_BRANDING, type BrandingConfig } from "@/modules/profiles/branding";
import type { ProfilesRow } from "@/modules/lib/database.types";

/**
 * Update the caller's agency branding (subdomain + brand colors/CTA).
 * Only agents/admin can register a tenant subdomain.
 */
export async function updateBranding(input: {
  subdomain?: string;
  branding?: Partial<BrandingConfig>;
}): Promise<ActionResult<{ subdomain: string | null }>> {
  const user = await requireUserOrThrow();
  if (user.role !== "agent" && user.role !== "admin") {
    return fail("Solo los agentes y administradores pueden configurar la marca de la agencia.");
  }

  const supabase = await createSupabaseServerClient();

  const subdomain = input.subdomain?.trim().toLowerCase();
  if (subdomain) {
    if (!/^[a-z0-9-]{2,63}$/.test(subdomain)) {
      return fail("El subdominio debe tener de 2 a 63 letras minúsculas, dígitos o guiones.");
    }
  }

  const patch: Partial<ProfilesRow> = {};
  if (subdomain) patch.subdomain = subdomain;
  if (input.branding) {
    const current = await getBrandingForUser(supabase, user.id);
    patch.branding_config = {
      ...DEFAULT_BRANDING,
      ...current,
      ...input.branding,
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (error) return fail(error.message);

  revalidatePath("/settings");
  return ok({ subdomain: subdomain ?? null });
}

async function getBrandingForUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<Partial<BrandingConfig>> {
  const { data } = await supabase
    .from("profiles")
    .select("branding_config")
    .eq("id", userId)
    .returns<Array<{ branding_config: Record<string, unknown> }>>()
    .limit(1);
  const raw = data?.[0]?.branding_config;
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  return {
    primary_color: typeof obj.primary_color === "string" ? obj.primary_color : undefined,
    logo_url: typeof obj.logo_url === "string" ? obj.logo_url : undefined,
    company_name:
      typeof obj.company_name === "string" ? obj.company_name : undefined,
    whatsapp_cta: typeof obj.whatsapp_cta === "string" ? obj.whatsapp_cta : undefined,
  };
}
