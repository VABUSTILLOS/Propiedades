import type { Metadata } from "next";
import Link from "next/link";
import { Route } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUser } from "@/modules/auth/session";
import { getMyFavorites } from "@/modules/favorites/queries";
import { env } from "@/modules/lib/env";
import { TourPlannerClient } from "@/modules/tour/components/tour-planner-client";

export const metadata: Metadata = { title: "Planificador de rutas" };

export const dynamic = "force-dynamic";

/**
 * Weekend tour planner: pick favorite properties and compute the optimal
 * driving route with the Google Maps Directions API. Degrades to a manual
 * ordering list when no server key is configured.
 */
export default async function PlanTourPage() {
  const user = await getCurrentUser();
  const favorites = user ? await getMyFavorites(user.id) : [];

  return (
    <PageShell size="md">
      <PageHeader
        eyebrow="Comprar"
        icon={Route}
        title="Planificador de rutas"
        description="Arma el itinerario óptimo de visitas del fin de semana desde tus favoritos."
      />

      {!user && (
        <p className="mt-4 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
          Puedes probar el planificador, pero tus favoritos no se cargarán.{" "}
          <Link
            href="/sign-up?next=/plan-tour"
            className="font-medium text-primary hover:underline"
          >
            Inicia sesión para cargar tus favoritos
          </Link>
        </p>
      )}

      <TourPlannerClient
        favorites={favorites}
        directionsApiKey={env.googleMapsServerKey}
      />
    </PageShell>
  );
}
