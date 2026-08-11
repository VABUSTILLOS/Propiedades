import type { Metadata } from "next";

import { requireUser } from "@/modules/auth/session";
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
  const user = await requireUser();
  const favorites = await getMyFavorites(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Planificador de rutas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Arma el itinerario óptimo de visitas del fin de semana desde tus
          favoritos.
        </p>
      </div>

      <TourPlannerClient
        favorites={favorites}
        directionsApiKey={env.googleMapsServerKey}
      />
    </div>
  );
}
