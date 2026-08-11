"use client";

import { useEffect, useRef } from "react";

import { useGoogleMaps } from "@/modules/maps/hooks";
import { GOOGLE_MAPS_AVAILABLE } from "@/modules/maps/hooks";

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
    const map = new google.maps.Map(ref.current, {
      center: { lat: 19.4326, lng: -99.1332 },
      zoom: 10,
    });
    markers.forEach((m) => {
      new google.maps.Marker({
        map,
        position: { lat: m.lat, lng: m.lng },
        title: m.title,
      });
    });
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
