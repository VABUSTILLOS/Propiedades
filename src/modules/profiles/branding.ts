import type { Json } from "@/modules/lib/database.types";

/**
 * Tenant branding loaded from `profiles.branding_config` (JSONB).
 * Matches the default shape in supabase/migrations/001_init.sql.
 */
export type BrandingConfig = {
  primary_color: string;
  logo_url: string | null;
  company_name: string;
  whatsapp_cta: string;
};

export const DEFAULT_BRANDING: BrandingConfig = {
  primary_color: "#B3562E",
  logo_url: null,
  company_name: "",
  whatsapp_cta: "",
};

export function parseBranding(raw: Json | null | undefined): BrandingConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_BRANDING;
  }
  const obj = raw as Record<string, unknown>;
  return {
    primary_color:
      typeof obj.primary_color === "string"
        ? obj.primary_color
        : DEFAULT_BRANDING.primary_color,
    logo_url:
      typeof obj.logo_url === "string" ? obj.logo_url : DEFAULT_BRANDING.logo_url,
    company_name:
      typeof obj.company_name === "string"
        ? obj.company_name
        : DEFAULT_BRANDING.company_name,
    whatsapp_cta:
      typeof obj.whatsapp_cta === "string"
        ? obj.whatsapp_cta
        : DEFAULT_BRANDING.whatsapp_cta,
  };
}
