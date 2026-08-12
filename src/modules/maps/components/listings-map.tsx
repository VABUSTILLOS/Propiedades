"use client";

import { useEffect, useRef } from "react";

import { useGoogleMaps, GOOGLE_MAPS_AVAILABLE } from "@/modules/maps/hooks";
import { createMap, createMarker } from "@/modules/maps/markers";

export type MapMarker = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  price: number;
};

/**
 * Static Google Map with listing pins. Renders an explanatory placeholder
 * when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.
 */
export function ListingsMap({ markers }: { markers: MapMarker[] }) {
  const google = useGoogleMaps();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!google || !ref.current) return;
    const map = createMap(google, ref.current, {
      center: { lat: 19.4326, lng: -99.1332 },
      zoom: 10,
    });
    const handles = markers.map((m) =>
      createMarker(google, {
        map,
        position: { lat: m.lat, lng: m.lng },
        title: m.title,
      }),
    );
    return () => {
      handles.forEach((handle) => handle.setMap(null));
    };
  }, [google, markers]);

  if (!GOOGLE_MAPS_AVAILABLE) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground">
        Map view requires a NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="h-64 w-full rounded-lg border"
      aria-label="Property map"
    />
  );
}
