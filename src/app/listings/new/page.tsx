import type { Metadata } from "next";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { ListingWizard } from "@/modules/listings/components/listing-wizard";

export const metadata: Metadata = { title: "List a property" };

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
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">List a property</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a draft and publish it once every step is complete. You can
          come back to drafts at any time.
        </p>
      </div>

      <ListingWizard />
    </div>
  );
}
