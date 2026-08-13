"use client";

import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";

import { GOOGLE_MAPS_AVAILABLE, useGoogleMaps } from "@/modules/maps/hooks";
import { createMap, createMarker } from "@/modules/maps/markers";
import { cn } from "@/lib/utils";

const compactPrice = new Intl.NumberFormat("es-MX", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatPrice(price: number, type: "sale" | "rent"): string {
  const amount = `$${compactPrice.format(price)}`;
  return type === "rent" ? `${amount}/mes` : amount;
}

/**
 * Single-location Google Map that pins the property at its coordinates.
 * Centered on the property (zoom 15) with a price pill marker via the
 * advanced marker API, falling back to a labeled legacy marker. Renders
 * an explanatory placeholder when the Maps API key is not configured.
 */
export function PropertyLocationMap({
  lat,
  lng,
  title,
  price,
  type,
  address,
  heightClass = "h-80",
}: {
  lat: number;
  lng: number;
  title: string;
  price: number;
  type: "sale" | "rent";
  address?: string | null;
  heightClass?: string;
}) {
  const google = useGoogleMaps();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!google || !containerRef.current || mapRef.current) return;

    const position = { lat, lng };
    const map = createMap(google, containerRef.current, {
      center: position,
      zoom: 15,
    });
    mapRef.current = map;

    const pill = document.createElement("div");
    pill.textContent = formatPrice(price, type);
    pill.style.cssText = [
      "background:#C4571D",
      "color:#fff",
      "border-radius:9999px",
      "padding:6px 12px",
      "font-size:13px",
      "font-weight:700",
      "white-space:nowrap",
      "cursor:pointer",
      "border:2px solid #fff",
      "box-shadow:0 2px 6px rgba(0,0,0,.25)",
      "font-family:inherit",
    ].join(";");

    const handle = createMarker(google, {
      map,
      position,
      title,
      content: pill,
      label: formatPrice(price, type),
    });

    return () => {
      handle.setMap(null);
      mapRef.current = null;
    };
  }, [google, lat, lng, title, price, type]);

  if (!GOOGLE_MAPS_AVAILABLE) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground",
          heightClass,
        )}
      >
        La vista de mapa requiere una clave NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {address && (
        <div className="flex items-center gap-2 border-b px-4 py-3 text-sm">
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="font-medium">{address}</span>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn("w-full", heightClass)}
        aria-label="Mapa de ubicación de la propiedad"
      />
    </div>
  );
}
