"use client";

import { useMemo, useState, useTransition } from "react";
import { MapPin, Route, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FavoriteWithProperty } from "@/modules/favorites/queries";

type Props = {
  favorites: FavoriteWithProperty[];
  directionsApiKey: string;
};

type Step = {
  propertyId: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  distance?: string;
  duration?: string;
};

type RouteResult = {
  steps: Step[];
  totalDuration: string;
  totalDistance: string;
};

/**
 * Weekend tour planner: select favorites, then compute the optimal route via
 * the Google Directions API (server-side route handler). Falls back to a
 * simple manual ordering when the API key is missing.
 */
export function TourPlannerClient({ favorites, directionsApiKey }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasKey = directionsApiKey.length > 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const picked = useMemo(
    () =>
      favorites
        .filter((f) => selected.has(f.id))
        .map((f) => ({
          id: f.id,
          title: f.property?.title ?? "Propiedad",
          address: f.property?.address ?? "",
          lat: f.property?.lat ?? 0,
          lng: f.property?.lng ?? 0,
        })),
    [favorites, selected],
  );

  const planRoute = () =>
    startTransition(async () => {
      setError(null);
      if (picked.length < 2) {
        setError("Selecciona al menos 2 propiedades para armar la ruta.");
        return;
      }
      const ids = picked.map((p) => p.id);
      const res = await fetch("/api/plan-tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "No se pudo calcular la ruta.");
        return;
      }
      const data = (await res.json()) as RouteResult;
      setRoute(data);
    });

  const manualRoute = () => {
    if (picked.length < 2) {
      setError("Selecciona al menos 2 propiedades para armar la ruta.");
      return;
    }
    setRoute({
      steps: picked.map((p) => ({
        propertyId: p.id,
        title: p.title,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
      })),
      totalDuration: "Manual (sin API de Directions)",
      totalDistance: "Orden de selección",
    });
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MapPin className="size-5 text-primary" />
          1. Elige propiedades
        </h2>
        {favorites.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Aún no tienes favoritos. Guarda propiedades primero.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {favorites.map((f) => (
              <li key={f.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                    className="mt-1 size-4 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {f.property?.title ?? "Propiedad"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.property?.colonia}, {f.property?.city}
                    </p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={hasKey ? planRoute : manualRoute}
            disabled={isPending || picked.length < 2}
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Route className="mr-2 size-4" />
            )}
            {isPending
              ? "Calculando…"
              : hasKey
                ? "Calcular ruta óptima"
                : "Crear itinerario"}
          </Button>
          {!hasKey && (
            <p className="self-center text-xs text-amber-600">
              Sin API key de Google Directions — se mostrará el orden de selección.
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}
      </div>

      {route && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Route className="size-5 text-primary" />
            Itinerario
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {route.totalDuration} · {route.totalDistance}
          </p>
          <ol className="mt-4 space-y-3">
            {route.steps.map((step, index) => (
              <li key={step.propertyId} className="flex gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    index === 0 ? "bg-emerald-600 text-white" : "bg-muted",
                  )}
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.address || "Dirección no capturada"}
                    {step.duration && step.distance
                      ? ` · ${step.duration} (${step.distance})`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
