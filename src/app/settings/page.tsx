import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { getProfileByUserId } from "@/modules/profiles/queries";
import { parseBranding } from "@/modules/profiles/branding";
import { BrandingSettingsForm } from "@/modules/profiles/components/branding-settings-form";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <GuestGate
          title="Configura tu cuenta"
          description="Administra tu perfil y la identidad de tu agencia. Crea una cuenta para personalizar tus ajustes."
          next="/settings"
        />
      </div>
    );
  }

  const profile = await getProfileByUserId(user.id);

  const canConfigure = user.role === "agent" || user.role === "admin";

  return (
    <PageShell size="sm" className="space-y-6">
      <PageHeader
        eyebrow="Cuenta"
        icon={Settings}
        title="Configuración"
        description="Administra tu cuenta y la identidad de tu agencia."
      />

      <BrandingSettingsForm
        initialSubdomain={profile?.subdomain ?? null}
        initialBranding={parseBranding(profile?.branding_config ?? null)}
        canConfigure={canConfigure}
      />
    </PageShell>
  );
}
