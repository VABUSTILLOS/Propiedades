import type { Metadata } from "next";
import { Store } from "lucide-react";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { ListingWizard } from "@/modules/listings/components/listing-wizard";

export const metadata: Metadata = { title: "Publicar una propiedad" };

export default async function NewListingPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <GuestGate
          title="Publica una propiedad"
          description="El asistente guiado te acompaña paso a paso para crear y publicar tu listado. Crea una cuenta para guardar tu borrador."
          next="/listings/new"
          actionLabel="Crear cuenta y publicar"
        />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Vender"
        icon={Store}
        title={<>Publicar una <Em>propiedad</Em></>}
        description="Crea un borrador y publícalo cuando cada paso esté completo. Puedes volver a tus borradores en cualquier momento."
        className="mb-8"
      />

      <ListingWizard />
    </PageShell>
  );
}
