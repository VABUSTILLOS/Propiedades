import type { Metadata } from "next";
import { Bookmark } from "lucide-react";

import { requireRole } from "@/modules/auth/session";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { getMarketplaceSavedListings } from "@/modules/guardados/queries";
import { GuardadosClient } from "@/modules/guardados/components/guardados-client";

export const metadata: Metadata = { title: "Guardados de Marketplace" };

export const dynamic = "force-dynamic";

export default async function AdminGuardadosPage() {
  await requireRole(["admin"]);

  const listings = await getMarketplaceSavedListings();

  return (
    <PageShell size="xl">
      <PageHeader
        eyebrow="Master"
        icon={Bookmark}
        title={
          <>
            Guardados de <Em>Marketplace</Em>
          </>
        }
        description="Tus publicaciones guardadas de Facebook Marketplace, sincronizadas con todas sus fotos y su descripción completa. Importa las propiedades como borradores para revisarlas y publicarlas en el portal."
      />

      <div className="mt-8">
        <GuardadosClient listings={listings} />
      </div>
    </PageShell>
  );
}
