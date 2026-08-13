import type { Metadata } from "next";
import { Landmark } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { getMyPreapproval } from "@/modules/preapproval/actions";
import { PreapprovalClient } from "@/modules/preapproval/components/preapproval-client";

export const metadata: Metadata = { title: "Preaprobación crediticia" };

export const dynamic = "force-dynamic";

export default async function PreapprovalPage() {
  const saved = await getMyPreapproval();

  return (
    <PageShell size="sm">
      <PageHeader
        eyebrow="Financiamiento"
        icon={Landmark}
        title={<><Em>Preaprobación</Em> crediticia</>}
        description="Precalifica rápido con Infonavit (NSS + fecha de nacimiento) o tu score bancario, y recibe propiedades que sí alcanzas."
      />

      <div className="mt-8">
        <PreapprovalClient saved={saved} />
      </div>
    </PageShell>
  );
}
