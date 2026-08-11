import type { Metadata } from "next";

import { getMyPreapproval } from "@/modules/preapproval/actions";
import { PreapprovalClient } from "@/modules/preapproval/components/preapproval-client";

export const metadata: Metadata = { title: "Preaprobación crediticia" };

export const dynamic = "force-dynamic";

export default async function PreapprovalPage() {
  const saved = await getMyPreapproval();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Preaprobación crediticia</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Precalifica rápido con Infonavit (NSS + fecha de nacimiento) o tu score
        bancario, y recibe propiedades que sí alcanzas.
      </p>

      <div className="mt-8">
        <PreapprovalClient saved={saved} />
      </div>
    </div>
  );
}
