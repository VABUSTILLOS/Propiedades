import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/modules/auth/session";
import { GuestGate } from "@/modules/auth/components/guest-gate";
import { getAgentDirectory } from "@/modules/profiles/queries";
import { getMlsListings } from "@/modules/listings/queries";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Em } from "@/components/layout/emphasis";
import { EmptyState } from "@/components/layout/empty-state";
import { Building2 } from "lucide-react";

export const metadata: Metadata = { title: "Red MLS" };

export const dynamic = "force-dynamic";

export default async function MlsNetworkPage() {
  // MLS listings are private to the agent network per RLS.
  const user = await getCurrentUser();
  const isAgent = user?.role === "agent" || user?.role === "admin";

  if (!isAgent) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <GuestGate
          title="Red MLS · Solo agentes"
          description="La bolsa privada de propiedades con desglose transparente de comisiones está reservada para agentes y administradores registrados."
          next="/mls"
          actionLabel="Crear cuenta de agente"
        />
      </div>
    );
  }

  const [agents, listings] = await Promise.all([
    getAgentDirectory(),
    getMlsListings(),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Vender"
        icon={Building2}
        title={<>Red <Em>MLS</Em></>}
        description={`Bolsa privada de agentes · ${listings.length} propiedades compartidas con desglose transparente de comisiones.`}
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Propiedades MLS</h2>
        {listings.length === 0 ? (
          <EmptyState
            className="mt-4"
            description="Aún no hay propiedades compartidas en la red MLS."
          />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => {
              const image = Array.isArray(listing.images)
                ? listing.images[0]
                : undefined;
              return (
                <Link
                  key={listing.id}
                  href={`/property/${listing.slug}`}
                  className="group overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
                >
                  {typeof image === "string" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={listing.title}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
                      Sin foto
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">
                        ${listing.price.toLocaleString()}
                        <span className="text-xs font-normal text-muted-foreground">
                          {" "}
                          {listing.currency}
                        </span>
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        MLS
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {listing.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {listing.colonia}, {listing.city}
                    </p>
                    <p className="mt-2 border-t pt-2 text-xs font-medium">
                      Comisión:{" "}
                      <span className="text-muted-foreground">
                        {listing.commission_split ?? "50/50"}
                      </span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Directorio de agentes</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin agentes registrados.</p>
          ) : (
            agents.map((agent) => (
              <div key={agent.id} className="rounded-lg border bg-card p-4">
                <p className="font-semibold">{agent.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {agent.email}
                </p>
                {agent.subdomain && (
                  <a
                    href={`/agencia/${agent.subdomain}`}
                    className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    /{agent.subdomain}
                  </a>
                )}
                {agent.rating_average != null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ★ {agent.rating_average.toFixed(1)} · {agent.reviews_count ?? 0}{" "}
                    reseñas
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </PageShell>
  );
}
