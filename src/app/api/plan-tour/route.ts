import { NextResponse } from "next/server";

import { getListingsByIds } from "@/modules/listings/queries";
import { env } from "@/modules/lib/env";
import { getCurrentUser } from "@/modules/auth/session";

export const runtime = "nodejs";

export type PlanTourResponse = {
  steps: Array<{
    propertyId: string;
    title: string;
    address: string;
    lat: number;
    lng: number;
    distance?: string;
    duration?: string;
  }>;
  totalDuration: string;
  totalDistance: string;
  source: "google" | "manual";
};

/**
 * Compute the optimal visiting route over selected favorites using the
 * Google Maps Directions API. Falls back to a manual ordered list when the
 * server key is not configured.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const rawIds = Array.isArray(body?.ids) ? body.ids : [];
  const ids = rawIds
    .filter((id): id is string => typeof id === "string")
    .slice(0, 6);

  if (ids.length < 2) {
    return NextResponse.json(
      { error: "Selecciona al menos 2 propiedades." },
      { status: 400 },
    );
  }

  const listings = await getListingsByIds(ids);

  const steps = listings.map((l) => ({
    propertyId: l.id,
    title: l.title,
    address: l.address || `${l.colonia}, ${l.city}`,
    lat: l.lat,
    lng: l.lng,
  }));

  const apiKey = env.googleMapsServerKey;
  if (!apiKey) {
    return NextResponse.json({
      steps,
      totalDuration: "Manual",
      totalDistance: "Orden de selección",
      source: "manual",
    } satisfies PlanTourResponse);
  }

  // Google Directions API: waypoints between the first and last property.
  const origin = `${steps[0]?.lat},${steps[0]?.lng}`;
  const destination = `${steps[steps.length - 1]?.lat},${steps[steps.length - 1]?.lng}`;
  const middle = steps.slice(1, -1);
  const waypoints =
    middle.length > 0
      ? `&waypoints=optimize:true|${middle
          .map((s) => `${s.lat},${s.lng}`)
          .join("|")}`
      : "";

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypoints}&mode=driving&key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as {
      status: string;
      routes?: Array<{
        legs?: Array<{
          start_location?: { lat: number; lng: number };
          distance?: { text?: string };
          duration?: { text?: string };
        }>;
        overview_polyline?: unknown;
      }>;
    };

    if (data.status !== "OK" || !data.routes?.[0]?.legs) {
      return NextResponse.json({
        steps,
        totalDuration: "Manual",
        totalDistance: "Orden de selección",
        source: "manual",
      } satisfies PlanTourResponse);
    }

    const legs = data.routes[0].legs;
    const ordered = steps.map((s, index) => {
      const leg = legs[index];
      return {
        ...s,
        distance: leg?.distance?.text,
        duration: leg?.duration?.text,
      };
    });

    const totalDuration =
      legs.reduce((sum, leg) => sum + parseDurationMinutes(leg?.duration?.text), 0) +
      " min aprox.";
    const totalDistance = legs
      .map((leg) => leg?.distance?.text)
      .filter(Boolean)
      .join(" + ");

    return NextResponse.json({
      steps: ordered,
      totalDuration,
      totalDistance: totalDistance || "—",
      source: "google",
    } satisfies PlanTourResponse);
  } catch {
    return NextResponse.json({
      steps,
      totalDuration: "Manual",
      totalDistance: "Orden de selección",
      source: "manual",
    } satisfies PlanTourResponse);
  }
}

/** Parse "1 hour 23 mins" / "15 mins" style durations into minutes. */
function parseDurationMinutes(text: string | undefined): number {
  if (!text) return 0;
  const hours = text.match(/(\d+)\s*hour/)?.[1] ?? "0";
  const mins = text.match(/(\d+)\s*mins?/)?.[1] ?? "0";
  return Number(hours) * 60 + Number(mins);
}
