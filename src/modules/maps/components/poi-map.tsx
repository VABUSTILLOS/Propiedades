"use client";

import { useEffect, useRef, useState } from "react";
import { Bus, MapPin, School } from "lucide-react";

import { GOOGLE_MAPS_AVAILABLE, useGoogleMaps } from "@/modules/maps/hooks";
import { createMap, createMarker, type MapMarkerHandle } from "@/modules/maps/markers";
import { cn } from "@/lib/utils";

type Props = {
  lat: number;
  lng: number;
  className?: string;
};

const MAX_MARKERS_PER_TYPE = 8;

/**
 * Read-only map centered on a property, showing nearby schools and
 * transit stations resolved via the Places nearbySearch API.
 */
export function POIMap({ lat, lng, className }: Props): React.JSX.Element {
  const google = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<MapMarkerHandle[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!google || !mapRef.current) return;

    const center = { lat, lng };
    const map = createMap(google, mapRef.current, { center, zoom: 15 });

    const propertyMarker = createMarker(google, {
      map,
      position: center,
      title: "Propiedad",
      color: "#dc2626",
    });

    const localMarkers: MapMarkerHandle[] = [propertyMarker];
    const service = new google.maps.places.PlacesService(mapRef.current);

    const addPoiMarkers = (
      results: google.maps.places.PlaceResult[] | null,
      iconUrl: string,
    ) => {
      (results ?? []).slice(0, MAX_MARKERS_PER_TYPE).forEach((place) => {
        if (!place.geometry) return;
        const marker = createMarker(google, {
          map,
          position: place.geometry.location,
          title: place.name ?? "",
          iconUrl,
        });
        localMarkers.push(marker);
      });
    };

    service.nearbySearch(
      { location: center, radius: 2000, type: "school" },
      (results) => addPoiMarkers(results, "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"),
    );

    service.nearbySearch(
      { location: center, radius: 2000, type: "transit_station" },
      (results) =>
        addPoiMarkers(results, "https://maps.google.com/mapfiles/ms/icons/green-dot.png"),
    );

    markersRef.current = localMarkers;
    setReady(true);

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      setReady(false);
    };
  }, [google, lat, lng]);

  if (!GOOGLE_MAPS_AVAILABLE) {
    return (
      <div
        className={cn(
          "flex h-72 w-full items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <MapPin className="h-4 w-4 shrink-0" />
        <span>
          Configura la clave de Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) para ver puntos de
          interés cercanos.
        </span>
      </div>
    );
  }

  if (!google) {
    return (
      <div
        className={cn(
          "flex h-72 w-full animate-pulse items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground",
          className,
        )}
      >
        Cargando mapa…
      </div>
    );
  }

  return (
    <div className={cn("relative h-72 w-full overflow-hidden rounded-lg border", className)}>
      <div ref={mapRef} className="absolute inset-0" aria-label="Mapa de puntos de interés" />
      {ready && (
        <div className="absolute left-2 top-2 z-10 space-y-1 rounded-md bg-background/90 px-2 py-1.5 text-xs shadow">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-red-500" />
            <span>Propiedad</span>
          </div>
          <div className="flex items-center gap-1.5">
            <School className="h-3 w-3 text-blue-500" />
            <span>Escuelas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bus className="h-3 w-3 text-green-500" />
            <span>Transporte</span>
          </div>
        </div>
      )}
    </div>
  );
}
