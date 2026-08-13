import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { UniversalImporterClient } from "@/modules/importer/components/universal-importer-client";

export const metadata: Metadata = { title: "Importar con IA" };

export const dynamic = "force-dynamic";

export default async function ImportPage() {

  return (
    <PageShell size="sm">
      <PageHeader
        eyebrow="Vender"
        icon={Sparkles}
        title={<>Importar con <Em>IA</Em></>}
        description="Pega la URL pública de Facebook Marketplace (u otro portal), un texto libre o una nota de voz: la IA extrae los datos, crea el borrador del listado y genera su flyer público automáticamente."
      />

      <div className="mt-8">
        <UniversalImporterClient />
      </div>
    </PageShell>
  );
}
