import type { Metadata } from "next";

import { requireUser } from "@/modules/auth/session";
import { UniversalImporterClient } from "@/modules/importer/components/universal-importer-client";

export const metadata: Metadata = { title: "Importar con IA" };

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Importar con IA</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pega la URL pública de Facebook Marketplace (u otro portal), un texto
        libre o una nota de voz: la IA extrae los datos, crea el borrador del
        listado y genera su flyer público automáticamente.
      </p>

      <div className="mt-8">
        <UniversalImporterClient />
      </div>
    </div>
  );
}
