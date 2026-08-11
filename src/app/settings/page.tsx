import type { Metadata } from "next";

import { requireUser } from "@/modules/auth/session";
import { getProfileByUserId } from "@/modules/profiles/queries";
import { parseBranding } from "@/modules/profiles/branding";
import { BrandingSettingsForm } from "@/modules/profiles/components/branding-settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfileByUserId(user.id);

  const canConfigure = user.role === "agent" || user.role === "admin";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and agency branding.
        </p>
      </div>

      <BrandingSettingsForm
        initialSubdomain={profile?.subdomain ?? null}
        initialBranding={parseBranding(profile?.branding_config ?? null)}
        canConfigure={canConfigure}
      />
    </div>
  );
}
