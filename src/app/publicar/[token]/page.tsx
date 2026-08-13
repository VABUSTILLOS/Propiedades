import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Link2Off } from "lucide-react";

import { getIntakeState } from "@/modules/intake/server";
import { IntakeWizard } from "@/modules/intake/components/intake-wizard";

export const metadata: Metadata = { title: "Sube tu propiedad" };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * "Sube tu propiedad" — unique-link wizard (Canal 2).
 *
 * The token in the URL is the capability: no login required. The property was
 * pre-filled by the WhatsApp + AI intake pipeline; this page only asks what
 * the AI could not detect, one giant question per screen.
 */
export default async function PublicarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getIntakeState(token);

  if (!result.ok) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {result.error === "expired" ? (
              <Clock className="size-5" />
            ) : (
              <Link2Off className="size-5" />
            )}
          </span>
          <h1 className="text-xl font-bold">
            {result.error === "expired"
              ? "Este enlace expiró"
              : "Enlace no válido"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {result.error === "expired"
              ? "Los enlaces duran 7 días. Escríbenos de nuevo por WhatsApp y te generamos uno nuevo al instante."
              : "No encontramos una propiedad asociada a este enlace. Verifica que lo hayas copiado completo."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Ir al inicio
          </Link>
        </div>
      </main>
    );
  }

  if (result.state.status === "activo") {
    redirect(`/property/${result.state.slug}`);
  }

  return <IntakeWizard token={token} initialState={result.state} />;
}
