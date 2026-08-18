import { headers } from "next/headers";

import { getProfileBySubdomain, subdomainFromHost } from "@/modules/profiles/queries";
import { parseBranding, type BrandingConfig } from "@/modules/profiles/branding";

export type ResolvedTenant = {
  subdomain: string | null;
  branding: BrandingConfig;
};

/**
 * Resolves the active tenant for the current request from the Host header
 * (e.g. `agencia.tuportal.com`). Falls back to platform defaults when the
 * host is the apex domain, www, localhost, or an unknown subdomain.
 */
export async function resolveTenant(): Promise<ResolvedTenant> {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "";

  const rawApex = process.env.NEXT_PUBLIC_SITE_URL ?? "100casas.mx";
  const apex = rawApex.startsWith("http")
    ? new URL(rawApex).hostname
    : rawApex.replace(/:\d+$/, "").toLowerCase();
  const subdomain = subdomainFromHost(host, apex);

  if (!subdomain) {
    return { subdomain: null, branding: parseBranding(null) };
  }

  const profile = await getProfileBySubdomain(subdomain);
  if (!profile) {
    return { subdomain, branding: parseBranding(null) };
  }

  return {
    subdomain,
    branding: parseBranding(profile.branding_config),
  };
}
